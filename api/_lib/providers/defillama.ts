import { z } from 'zod';
import { fetchJson } from '../http.js';
import { swr } from '../cache.js';
import { metaFromCache, type ProviderResult } from '../respond.js';

// =============================================================================
// Proveedor: DefiLlama Stablecoins (gratis, sin clave, API JSON oficial).
//   https://stablecoins.llama.fi/stablecoins?includePrices=true
//
// Mide la LIQUIDEZ del mercado cripto: cuánto capital en stablecoins hay listo
// para entrar. La expansión sostenida suele acompañar a fases alcistas y la
// contracción a fases de salida de capital.
//
// NO es un dato en vivo: DefiLlama lo recalcula cada pocas horas y las
// variaciones son a 1/7/30 días. Se etiqueta siempre como "diario".
// Nada de scraping HTML: es el endpoint JSON público del proyecto.
// =============================================================================

const PeggedUsd = z.object({ peggedUSD: z.number().nullable().optional() }).nullable().optional();

const AssetSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  pegType: z.string().optional(),
  circulating: PeggedUsd,
  circulatingPrevDay: PeggedUsd,
  circulatingPrevWeek: PeggedUsd,
  circulatingPrevMonth: PeggedUsd,
});

const ResponseSchema = z.object({ peggedAssets: z.array(AssetSchema) });

type Asset = z.infer<typeof AssetSchema>;

/** Extrae el valor USD de un bloque `circulating`; 0 si no lo hay. */
function usd(block: Asset['circulating']): number {
  const v = block?.peggedUSD;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function pctChange(now: number, before: number): number | null {
  if (before <= 0) return null;
  return Number((((now - before) / before) * 100).toFixed(2));
}

export interface StablecoinAsset {
  symbol: string;
  name: string;
  circulatingUsd: number;
  change7dPct: number | null;
  change30dPct: number | null;
}

export interface StablecoinLiquidity {
  /** Capitalización total de stablecoins ancladas al dólar (USD). */
  totalUsd: number;
  change24hPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  /** Expansión / contracción / estable, según la variación a 30 días. */
  trend: 'expansion' | 'contraccion' | 'estable';
  /** Desglose de los mayores emisores (USDT, USDC, …). */
  top: StablecoinAsset[];
  observedAt: string;
}

export async function getStablecoinLiquidity(): Promise<ProviderResult<StablecoinLiquidity>> {
  // Dato diario: TTL 6 h, stale 48 h.
  const r = await swr('llama:stables', { ttlMs: 6 * 60 * 60_000, staleMs: 48 * 60 * 60_000 }, async () => {
    const raw = await fetchJson<unknown>('https://stablecoins.llama.fi/stablecoins?includePrices=true', {
      provider: 'defillama',
      timeoutMs: 15_000,
    });

    // Solo stablecoins ancladas al dólar: mezclar pegs (EUR, oro…) falsearía el total.
    const assets = ResponseSchema.parse(raw).peggedAssets.filter(
      (a) => (a.pegType ?? 'peggedUSD') === 'peggedUSD',
    );
    if (assets.length === 0) throw new Error('DefiLlama no devolvió stablecoins en USD');

    const sum = (pick: (a: Asset) => Asset['circulating']) =>
      assets.reduce((acc, a) => acc + usd(pick(a)), 0);

    const totalUsd = sum((a) => a.circulating);
    if (totalUsd <= 0) throw new Error('DefiLlama: capitalización total inválida');

    const change30dPct = pctChange(totalUsd, sum((a) => a.circulatingPrevMonth));

    const top: StablecoinAsset[] = assets
      .map((a) => ({
        symbol: a.symbol,
        name: a.name,
        circulatingUsd: usd(a.circulating),
        change7dPct: pctChange(usd(a.circulating), usd(a.circulatingPrevWeek)),
        change30dPct: pctChange(usd(a.circulating), usd(a.circulatingPrevMonth)),
      }))
      .sort((a, b) => b.circulatingUsd - a.circulatingUsd)
      .slice(0, 5);

    return {
      totalUsd: Math.round(totalUsd),
      change24hPct: pctChange(totalUsd, sum((a) => a.circulatingPrevDay)),
      change7dPct: pctChange(totalUsd, sum((a) => a.circulatingPrevWeek)),
      change30dPct,
      trend:
        change30dPct == null || Math.abs(change30dPct) < 1
          ? 'estable'
          : change30dPct > 0
            ? 'expansion'
            : 'contraccion',
      top,
      observedAt: new Date().toISOString(),
    } satisfies StablecoinLiquidity;
  });

  return {
    data: r.value,
    meta: metaFromCache('defillama', r.status, r.storedAt, { observedAt: r.value.observedAt }),
  };
}
