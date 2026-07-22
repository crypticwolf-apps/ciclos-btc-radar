import { Activity, Gauge, Layers } from 'lucide-react';
import { useOnchainMetrics } from '@/hooks/useOnchainMetrics';
import type { CycleOnchain, OnchainMetric, StablecoinLiquidity } from '@/types/onchain';
import { statusLabel, type SourceMeta } from '@/types/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cx, formatNumberEs, formatPercent, timeAgo, formatDateEs } from '@/lib/format';

// =============================================================================
// Sección on-chain: métricas reales de la red y de valoración del ciclo.
//
// Fuentes (todas gratuitas, sin clave y atribuidas en la propia tarjeta):
//   Coin Metrics Community → MVRV, NUPL, Puell, hashrate, tx/día, direcciones.
//   DefiLlama              → liquidez en stablecoins.
//   mempool.space          → progreso del halving.
//
// Son datos DIARIOS: cada tarjeta muestra su fecha real de observación y nunca
// se etiquetan como "en vivo".
// =============================================================================

const DEFINICIONES: Record<string, string> = {
  hashrate:
    'Potencia de cómputo total que asegura la red. Más hashrate = más seguridad y más convicción de los mineros.',
  txPerDay: 'Transacciones confirmadas al día.',
  activeAddresses: 'Direcciones únicas activas al día; mide la amplitud de uso de la red.',
  supply: 'Bitcoins en circulación, de un máximo de 21 millones.',
};

const STATUS_DOT: Record<string, string> = {
  live: 'bg-emerald-500',
  cached: 'bg-sky-500',
  stale: 'bg-amber-500',
  unavailable: 'bg-red-500',
  locked: 'bg-zinc-500',
};

function fmtValue(m: OnchainMetric): string {
  switch (m.unit) {
    case 'EH/s':
      return formatNumberEs(m.value, 0);
    case 'tx':
    case 'dir.':
    case 'BTC':
      return formatNumberEs(Math.round(m.value));
    default:
      return formatNumberEs(m.value, 2);
  }
}

function FreshnessBadge({ meta, daily }: { meta: SourceMeta | undefined; daily?: boolean }) {
  if (!meta) return null;
  // Un dato diario no se anuncia como "en vivo" aunque la petición sea reciente.
  const label = daily && (meta.status === 'live' || meta.status === 'cached') ? 'Diario' : statusLabel(meta.status);
  const ago = meta.fetchedAt ? ` · consultado ${timeAgo(new Date(meta.fetchedAt))}` : '';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={`Fuente: ${meta.provider}`}>
      <span className={cx('h-2 w-2 rounded-full', STATUS_DOT[meta.status] ?? 'bg-zinc-500')} aria-hidden="true" />
      {label}
      {ago}
    </span>
  );
}

function MetricTile({ m }: { m: OnchainMetric }) {
  const def = DEFINICIONES[m.id] ?? '';
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-sm font-semibold text-secondary">
          {m.label}
          {def && <InfoTooltip text={def} />}
        </span>
        {m.changePct != null && (
          <span className={cx('font-mono text-xs', m.changePct >= 0 ? 'text-bull' : 'text-bear')}>
            {formatPercent(m.changePct)}
          </span>
        )}
      </div>
      <div className="font-mono text-2xl font-bold text-primary">{fmtValue(m)}</div>
      <div className="mt-0.5 text-xs text-muted">
        {m.unit} · dato del {formatDateEs(m.observedAt)}
      </div>
    </div>
  );
}

/** Barra de posición de una métrica dentro de un rango histórico conocido. */
function RangeBar({ value, min, max, zones }: { value: number; min: number; max: number; zones: string }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-btc transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] leading-tight text-muted">{zones}</p>
    </div>
  );
}

function CycleValuation({ cycle, meta }: { cycle: CycleOnchain; meta: SourceMeta | undefined }) {
  const { formatCompactFromUsd } = useCurrency();
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xl font-bold text-btc">
          <Gauge size={20} aria-hidden="true" /> Valoración del ciclo
          <InfoTooltip text="Compara el precio de mercado con el precio al que se movieron por última vez las monedas. Ayuda a situar el ciclo, pero no predice el precio." />
        </h2>
        <FreshnessBadge meta={meta} daily />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-1 text-sm font-semibold text-secondary">
            MVRV
            <InfoTooltip text="Capitalización de mercado dividida entre la capitalización realizada. Por debajo de 1 el mercado cotiza bajo su coste medio; por encima de 3,5 suele indicar sobrecalentamiento." />
          </div>
          <div className="font-mono text-3xl font-bold text-primary">{cycle.mvrv.toFixed(2)}</div>
          <RangeBar value={cycle.mvrv} min={0.5} max={4} zones="0,5 — suelo histórico · 1 — coste medio · 3,5+ — sobrecalentado" />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-1 text-sm font-semibold text-secondary">
            NUPL
            <InfoTooltip text="Beneficio latente del conjunto del mercado, como fracción de su capitalización. Se deriva del MVRV (1 − 1/MVRV). Negativo = el mercado pierde de media." />
          </div>
          <div className="font-mono text-3xl font-bold text-primary">
            {(cycle.nupl * 100).toFixed(1)}%
          </div>
          <RangeBar value={cycle.nupl} min={-0.3} max={0.75} zones="Negativo — capitulación · 0,5+ — euforia histórica" />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-1 text-sm font-semibold text-secondary">
            Capitalización realizada
            <InfoTooltip text="Valor de todas las monedas al precio de su último movimiento en cadena. Aproxima el coste agregado del mercado." />
          </div>
          <div className="font-mono text-2xl font-bold text-primary">
            {formatCompactFromUsd(cycle.realizedCapUsd)}
          </div>
          <p className="mt-1 text-xs text-muted">
            frente a {formatCompactFromUsd(cycle.marketCapUsd)} de capitalización de mercado
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-1 text-sm font-semibold text-secondary">
            Puell Multiple
            <InfoTooltip text="Ingresos diarios de los mineros por emisión frente a su media de 365 días. Valores bajos han coincidido con zonas de suelo; altos, con techos." />
          </div>
          {cycle.puell == null ? (
            <p className="mt-2 text-sm text-muted">Dato no disponible.</p>
          ) : (
            <>
              <div className="font-mono text-3xl font-bold text-primary">{cycle.puell.toFixed(2)}</div>
              <RangeBar value={cycle.puell} min={0.3} max={4} zones="&lt;0,5 — mineros exprimidos · &gt;4 — emisión muy rentable" />
            </>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Fuente: Coin Metrics Community · dato diario del {formatDateEs(cycle.observedAt)} · la
        capitalización realizada y el NUPL se derivan del MVRV por identidad matemática, no son
        estimaciones.
      </p>
    </Card>
  );
}

function LiquidityCard({ liquidity, meta }: { liquidity: StablecoinLiquidity; meta: SourceMeta | undefined }) {
  const { formatCompactFromUsd } = useCurrency();
  const trendLabel =
    liquidity.trend === 'expansion'
      ? 'Expansión de liquidez'
      : liquidity.trend === 'contraccion'
        ? 'Contracción de liquidez'
        : 'Liquidez estable';
  const trendTone =
    liquidity.trend === 'expansion' ? 'text-bull' : liquidity.trend === 'contraccion' ? 'text-bear' : 'text-muted';

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xl font-bold text-btc">
          <Layers size={20} aria-hidden="true" /> Liquidez en stablecoins
          <InfoTooltip text="Capital en stablecoins ancladas al dólar. Su expansión suele acompañar a fases de entrada de dinero al mercado, y su contracción a fases de salida." />
        </h2>
        <FreshnessBadge meta={meta} daily />
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div>
          <div className="font-mono text-3xl font-bold text-primary">
            {formatCompactFromUsd(liquidity.totalUsd)}
          </div>
          <p className={cx('text-sm font-semibold', trendTone)}>{trendLabel}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <Delta label="7 días" value={liquidity.change7dPct} />
          <Delta label="30 días" value={liquidity.change30dPct} />
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {liquidity.top.map((asset) => (
          <li
            key={asset.symbol}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="text-sm font-semibold text-primary">{asset.symbol}</span>
              <span className="ml-2 truncate text-xs text-muted">{asset.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="font-mono text-sm text-secondary">
                {formatCompactFromUsd(asset.circulatingUsd)}
              </span>
              {asset.change30dPct != null && (
                <span
                  className={cx('font-mono text-xs', asset.change30dPct >= 0 ? 'text-bull' : 'text-bear')}
                >
                  {formatPercent(asset.change30dPct)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted">
        Fuente: DefiLlama · dato diario, no intradía · solo stablecoins ancladas al dólar.
      </p>
    </Card>
  );
}

function Delta({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <span>
      <span className={cx('font-mono font-semibold', value >= 0 ? 'text-bull' : 'text-bear')}>
        {formatPercent(value)}
      </span>
      <span className="ml-1 text-xs text-muted">{label}</span>
    </span>
  );
}

export function OnchainSection() {
  const query = useOnchainMetrics();
  const data = query.data?.data;
  const sources = query.data?.meta.sources ?? [];
  const activityMeta = sources.find((s) => s.provider.startsWith('coinmetrics:activity'));
  const cycleMeta = sources.find((s) => s.provider === 'coinmetrics');
  const liquidityMeta = sources.find((s) => s.provider === 'defillama');

  if (query.isLoading) return <Skeleton className="h-[480px]" />;
  if (query.isError || !data) {
    return (
      <ErrorState
        message={query.error?.message ?? 'No se pudieron cargar las métricas on-chain.'}
        onRetry={() => query.refetch()}
      />
    );
  }

  const metrics = data.activity?.metrics ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {data.cycle && <CycleValuation cycle={data.cycle} meta={cycleMeta} />}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-xl font-bold text-btc">
            <Activity size={20} aria-hidden="true" /> Actividad de la red
            <InfoTooltip text="Métricas reales de la cadena de Bitcoin (Coin Metrics Community). Reflejan seguridad, uso y actividad. Se publican una vez al día." />
          </h2>
          <FreshnessBadge meta={activityMeta} daily />
        </div>
        {metrics.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-muted">
            Dato no disponible
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((m) => (
              <MetricTile key={m.id} m={m} />
            ))}
          </div>
        )}
      </Card>

      {data.liquidity && <LiquidityCard liquidity={data.liquidity} meta={liquidityMeta} />}
    </div>
  );
}
