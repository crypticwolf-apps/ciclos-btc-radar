import { z } from 'zod';
import { fetchJson } from '../http';
import { swr } from '../cache';
import { metaFromCache, type ProviderResult } from '../respond';
import { computeTechnicals, halvingTiming, type Technicals } from '@/lib/indicators';

// =============================================================================
// Proveedor: Coin Metrics Community API (gratis, SIN clave, sin scraping).
//   https://community-api.coinmetrics.io/v4/timeseries/asset-metrics
//
// El plan community expone un subconjunto de métricas. Comprobado disponible
// sin credenciales para `btc` en frecuencia diaria:
//   PriceUSD, CapMVRVCur, CapMrktCurUSD, IssTotUSD, HashRate, AdrActCnt,
//   TxCnt, SplyCur
//
// NO disponibles en community (devuelven 403/400) y por tanto NO se muestran:
//   CapRealUSD, RevUSD, DiffMean, FeeTotUSD y la métrica compuesta
//   PuellMultiple.
//
// De las que SÍ hay se derivan, por identidades exactas (no estimaciones):
//   realizedCap = CapMrktCurUSD / CapMVRVCur
//   NUPL        = (mktCap - realizedCap) / mktCap = 1 - 1/MVRV
//   Puell       = IssTotUSD(hoy) / media(IssTotUSD, 365 d)
//
// Todos los datos son DIARIOS: se etiquetan como tal y nunca como "en vivo".
// =============================================================================

const BASE = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';

const RowSchema = z.object({ time: z.string() }).catchall(z.unknown());
const ResponseSchema = z.object({ data: z.array(RowSchema) });

type Row = z.infer<typeof RowSchema>;

/** Lee una métrica numérica de una fila; `null` si falta o no es finita. */
function num(row: Row, key: string): number | null {
  const raw = row[key];
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** YYYY-MM-DD de hace `days` días (UTC), formato que espera la API. */
function startDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function fetchSeries(metrics: string[], startTime: string): Promise<Row[]> {
  const url =
    `${BASE}?assets=btc&metrics=${metrics.join(',')}` +
    `&frequency=1d&start_time=${startTime}&page_size=10000`;
  const raw = await fetchJson<unknown>(url, { provider: 'coinmetrics', timeoutMs: 15_000 });
  const rows = ResponseSchema.parse(raw).data;
  if (rows.length === 0) throw new Error('Coin Metrics devolvió una serie vacía');
  return rows; // la API devuelve orden ascendente por fecha
}

/** Último valor no nulo de una métrica, con su fecha de observación. */
function lastOf(rows: Row[], key: string): { value: number; at: string } | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = num(rows[i]!, key);
    if (v != null) return { value: v, at: rows[i]!.time };
  }
  return null;
}

// --- Indicadores técnicos sobre el histórico COMPLETO ------------------------

/**
 * Cierres diarios de BTC desde 2010 (unos 5.800 puntos en una sola petición).
 *
 * Se usa para los indicadores de ciclo largo —sobre todo la media de 200
 * SEMANAS, que necesita 1.400 cierres— porque el plan gratuito de CoinGecko
 * limita el histórico a 365 días y ahí esa media no se puede calcular.
 */
export async function getTechnicals(): Promise<ProviderResult<Technicals>> {
  const r = await swr('cm:technicals', { ttlMs: 6 * 60 * 60_000, staleMs: 48 * 60 * 60_000 }, async () => {
    const rows = await fetchSeries(['PriceUSD'], '2010-01-01');

    const closes: number[] = [];
    const times: number[] = [];
    for (const row of rows) {
      const price = num(row, 'PriceUSD');
      if (price == null || price <= 0) continue;
      closes.push(price);
      times.push(Date.parse(row.time));
    }
    if (closes.length < 400) throw new Error('Coin Metrics: histórico de precio insuficiente');

    // El ciclo actual empieza en el último halving.
    const halvingMs = Date.parse(halvingTiming().lastHalvingDate);
    const cycleStartIndex = times.findIndex((t) => t >= halvingMs);

    return computeTechnicals(closes, {
      cycleStartIndex: cycleStartIndex >= 0 ? cycleStartIndex : undefined,
    });
  });

  return { data: r.value, meta: metaFromCache('coinmetrics:technicals', r.status, r.storedAt) };
}

// --- Métricas de ciclo (MVRV / NUPL / Realized cap / Puell) ------------------

export interface CycleOnchainPoint {
  t: number; // epoch ms
  mvrv: number;
  nupl: number;
}

export interface CycleOnchain {
  mvrv: number;
  /** Net Unrealized Profit/Loss, identidad 1 - 1/MVRV. */
  nupl: number;
  realizedCapUsd: number;
  marketCapUsd: number;
  /** Puell Multiple: emisión diaria en USD frente a su media de 365 d. */
  puell: number | null;
  /** Fecha REAL de observación del último dato (ISO UTC). Dato diario. */
  observedAt: string;
  /** Serie MVRV/NUPL del último año para el gráfico de ciclo. */
  history: CycleOnchainPoint[];
}

export async function getCycleOnchain(): Promise<ProviderResult<CycleOnchain>> {
  const r = await swr('cm:cycle', { ttlMs: 6 * 60 * 60_000, staleMs: 48 * 60 * 60_000 }, async () => {
    // 400 días: suficiente para la media de 365 d del Puell Multiple.
    const rows = await fetchSeries(['CapMVRVCur', 'CapMrktCurUSD', 'IssTotUSD'], startDate(400));

    const mvrvLast = lastOf(rows, 'CapMVRVCur');
    const capLast = lastOf(rows, 'CapMrktCurUSD');
    if (!mvrvLast || !capLast || mvrvLast.value <= 0) {
      throw new Error('Coin Metrics: MVRV o market cap no disponibles');
    }

    // Puell = emisión USD de hoy / media de la emisión USD de los últimos 365 d.
    const issuance = rows
      .map((row) => num(row, 'IssTotUSD'))
      .filter((v): v is number => v != null && v > 0);
    const window = issuance.slice(-365);
    const avgIssuance = window.length >= 200 ? window.reduce((a, b) => a + b, 0) / window.length : 0;
    const lastIssuance = issuance[issuance.length - 1] ?? 0;
    const puell = avgIssuance > 0 ? Number((lastIssuance / avgIssuance).toFixed(3)) : null;

    const history: CycleOnchainPoint[] = [];
    for (const row of rows.slice(-365)) {
      const m = num(row, 'CapMVRVCur');
      if (m == null || m <= 0) continue;
      history.push({
        t: Date.parse(row.time),
        mvrv: Number(m.toFixed(4)),
        nupl: Number((1 - 1 / m).toFixed(4)),
      });
    }

    return {
      mvrv: Number(mvrvLast.value.toFixed(4)),
      nupl: Number((1 - 1 / mvrvLast.value).toFixed(4)),
      realizedCapUsd: Math.round(capLast.value / mvrvLast.value),
      marketCapUsd: Math.round(capLast.value),
      puell,
      observedAt: mvrvLast.at,
      history,
    } satisfies CycleOnchain;
  });

  return {
    data: r.value,
    meta: metaFromCache('coinmetrics', r.status, r.storedAt, { observedAt: r.value.observedAt }),
  };
}

// --- Actividad de red (hashrate, tx, direcciones, supply) -------------------

export interface OnchainMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  /** Variación % frente al valor de hace ~30 días. */
  changePct: number | null;
  observedAt: string;
}

export interface OnchainActivity {
  metrics: OnchainMetric[];
}

interface MetricDef {
  id: string;
  key: string;
  label: string;
  unit: string;
  /** Convierte la unidad cruda de Coin Metrics a la unidad mostrada. */
  scale?: (v: number) => number;
}

const ACTIVITY_DEFS: MetricDef[] = [
  // HashRate llega en TH/s → EH/s (1 EH/s = 1e6 TH/s).
  { id: 'hashrate', key: 'HashRate', label: 'Hashrate', unit: 'EH/s', scale: (v) => v / 1e6 },
  { id: 'txPerDay', key: 'TxCnt', label: 'Transacciones/día', unit: 'tx' },
  { id: 'activeAddresses', key: 'AdrActCnt', label: 'Direcciones activas', unit: 'dir.' },
  { id: 'supply', key: 'SplyCur', label: 'Supply circulante', unit: 'BTC' },
];

export async function getOnchainActivity(): Promise<ProviderResult<OnchainActivity>> {
  const r = await swr('cm:activity', { ttlMs: 6 * 60 * 60_000, staleMs: 48 * 60 * 60_000 }, async () => {
    const rows = await fetchSeries(ACTIVITY_DEFS.map((d) => d.key), startDate(35));

    const metrics: OnchainMetric[] = [];
    for (const def of ACTIVITY_DEFS) {
      const last = lastOf(rows, def.key);
      if (!last) continue; // métrica no servida → se omite, no se inventa
      const scale = def.scale ?? ((v: number) => v);
      const value = scale(last.value);
      const firstRow = rows.find((row) => num(row, def.key) != null);
      const base = firstRow ? scale(num(firstRow, def.key)!) : null;
      metrics.push({
        id: def.id,
        label: def.label,
        value,
        unit: def.unit,
        changePct: base && base !== 0 ? Number((((value - base) / base) * 100).toFixed(1)) : null,
        observedAt: last.at,
      });
    }

    if (metrics.length === 0) throw new Error('Coin Metrics no devolvió métricas de actividad');
    return { metrics } satisfies OnchainActivity;
  });

  return { data: r.value, meta: metaFromCache('coinmetrics:activity', r.status, r.storedAt) };
}
