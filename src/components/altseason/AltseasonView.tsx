import { useMemo, useState } from 'react';
import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';
import { useAltseason } from '@/hooks/useAltseason';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { AltseasonGauge } from './AltseasonGauge';
import { AltseasonRanking } from './AltseasonRanking';
import { AltseasonBreadthChart } from './AltseasonBreadthChart';
import { PHASES } from '@/lib/altseason/config';
import type { AltseasonResponse } from '@/types/altseason';
import { cx, formatDateTimeMadrid, formatNumberEs, formatPercent } from '@/lib/format';

// =============================================================================
// Ciclos → Altseason.
//
// Orden pensado para móvil: primero el score y la fase (lo que resume el estado
// del mercado de un vistazo), luego señales, métricas, gráfico, ranking y el
// desglose por componentes. Todo lo secundario va en desplegables cerrados.
//
// La metodología —qué mide cada componente, cómo se normaliza, qué activos se
// excluyen y con qué fuentes— está en Ajustes → Información, no aquí.
// =============================================================================

export function AltseasonView() {
  const query = useAltseason();
  const data = query.data?.data;
  const meta = query.data?.meta.sources[0];

  if (query.isLoading) return <Skeleton className="h-[520px]" />;

  if (query.isError) {
    return (
      <ErrorState
        message={query.error?.message ?? 'No se pudo cargar el análisis de altseason.'}
        onRetry={() => query.refetch()}
      />
    );
  }

  if (!data) {
    return (
      <Card>
        <h2 className="text-lg font-bold text-primary">Altseason Score no disponible</h2>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          No se han podido obtener los datos de mercado necesarios. La sección vuelve sola en
          cuanto el proveedor responda; no se muestra una puntuación inventada mientras tanto.
        </p>
        {meta?.note && <p className="mt-2 text-xs text-muted">Detalle: {meta.note}</p>}
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <SummaryCard data={data} status={meta?.status} />
      <PhaseCard data={data} />
      <SignalsCards data={data} />
      <MetricsCard data={data} />
      <AltseasonBreadthChart points={data.breadthHistory} />
      <AltseasonRanking rows={data.ranking} />
      <ComponentsCard data={data} />
    </div>
  );
}

// --- Resumen ----------------------------------------------------------------

function SummaryCard({ data, status }: { data: AltseasonResponse; status?: string }) {
  const { result, metrics } = data;
  const unavailable = result.score == null;

  return (
    <Card className="!p-4 sm:!p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-1.5 text-lg font-extrabold text-primary sm:text-xl">
          Altseason Score
          <InfoTooltip text="Mide si el capital está rotando de Bitcoin hacia las altcoins. Se calcula con siete métricas reales ponderadas; no es el Score de Oportunidad general ni una recomendación." />
        </h1>
        <FreshnessTag
          freshness={status === 'stale' || status === 'cached' ? 'cache' : 'actualizado'}
          at={data.observedAt}
          source="CoinGecko · Binance · DefiLlama"
        />
      </div>

      <AltseasonGauge
        score={result.score}
        classification={result.classification}
        phaseLabel={result.phaseLabel}
      />

      {unavailable ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm leading-relaxed text-secondary">
          {result.unavailableReason} No se muestra un 0: faltan datos, que no es lo mismo que una
          rotación nula.
        </p>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-secondary">{result.summary}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Mini label="Fase del ciclo" value={result.phaseLabel} />
        <Mini
          label="Confianza"
          value={result.confidence}
          tone={
            result.confidence === 'alta' ? 'bull' : result.confidence === 'media' ? 'btc' : 'bear'
          }
        />
        <Mini label="Cobertura" value={`${result.coverage}%`} hint={`${result.componentsAvailable}/${result.componentsTotal} métricas`} />
        <Mini label="Altcoins analizadas" value={String(metrics.analyzedCount)} hint={`${data.excludedCount} excluidas`} />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Actualizado {formatDateTimeMadrid(data.observedAt)}.
      </p>
    </Card>
  );
}

function Mini({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'bull' | 'bear' | 'btc';
}) {
  const color =
    tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : tone === 'btc' ? 'text-btc' : 'text-primary';
  return (
    <div className="liquid-subcard min-w-0 rounded-xl p-2.5">
      <p className="truncate text-[10px] leading-tight text-muted">{label}</p>
      <p className={cx('truncate text-sm font-bold capitalize', color)}>{value}</p>
      {hint && <p className="truncate text-[10px] leading-tight text-muted">{hint}</p>}
    </div>
  );
}

// --- Fase del ciclo ---------------------------------------------------------

function PhaseCard({ data }: { data: AltseasonResponse }) {
  // Si el backend enviara una fase que este catálogo no conoce —una versión
  // nueva del cálculo contra un front antiguo—, antes se caía la vista entera
  // con un error de React. Ahora simplemente no se pinta esta tarjeta.
  const phase = PHASES[data.result.phase];
  if (!phase) return null;

  return (
    <Card className="!p-4 sm:!p-5">
      <h2 className="text-base font-bold text-primary sm:text-lg">Fase del ciclo de altcoins</h2>
      <p className="mt-1 text-sm font-semibold text-btc">{phase.label}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-secondary">{phase.description}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border-l-2 border-bull bg-white/5 px-3 py-2">
          <p className="text-[11px] font-semibold text-muted">Para avanzar de fase</p>
          <p className="mt-0.5 text-xs leading-relaxed text-secondary">{phase.next}</p>
        </div>
        <div className="rounded-xl border-l-2 border-bear bg-white/5 px-3 py-2">
          <p className="text-[11px] font-semibold text-muted">Señal de retroceso</p>
          <p className="mt-0.5 text-xs leading-relaxed text-secondary">{phase.back}</p>
        </div>
      </div>
    </Card>
  );
}

// --- Señales ----------------------------------------------------------------

function SignalsCards({ data }: { data: AltseasonResponse }) {
  const { signalsFor, signalsAgainst } = data.result;
  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
      <SignalList
        title="Señales a favor"
        icon={<TrendingUp size={16} className="text-bull" />}
        signals={signalsFor}
        tone="bull"
        empty="Ninguna señal apoya una rotación hacia altcoins ahora mismo."
      />
      <SignalList
        title="Señales en contra"
        icon={<TrendingDown size={16} className="text-bear" />}
        signals={signalsAgainst}
        tone="bear"
        empty="Ninguna señal contradice la rotación ahora mismo."
      />
    </div>
  );
}

function SignalList({
  title,
  icon,
  signals,
  tone,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  signals: { text: string; evidence: string }[];
  tone: 'bull' | 'bear';
  empty: string;
}) {
  return (
    <Card className="!p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary">
        {icon} {title}
        <span className="ml-auto text-xs text-muted">{signals.length}</span>
      </h3>
      {signals.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {signals.map((s) => (
            <li
              key={s.text}
              className={cx(
                'rounded-lg border-l-2 bg-white/5 px-2.5 py-2',
                tone === 'bull' ? 'border-bull' : 'border-bear',
              )}
            >
              <p className="text-xs leading-relaxed text-secondary">{s.text}</p>
              <p className="mt-0.5 font-mono text-[10px] text-muted">{s.evidence}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// --- Métricas ---------------------------------------------------------------

function MetricsCard({ data }: { data: AltseasonResponse }) {
  const { formatCompactFromUsd } = useCurrency();
  const m = data.metrics;

  const rows = useMemo(
    () => [
      {
        label: 'Altcoins que superan a BTC',
        value:
          m.outperform90Pct != null && m.outperformCount != null
            ? `${m.outperformCount} de ${m.analyzedCount} (${m.outperform90Pct}%)`
            : null,
        hint: m.btcReturn90 != null ? `BTC ${formatPercent(m.btcReturn90)} en 90 d` : undefined,
      },
      {
        label: 'Dominancia de Bitcoin',
        value: m.btcDominance != null ? `${m.btcDominance}%` : null,
        hint:
          m.dominanceChange30d != null
            ? `${m.dominanceChange30d >= 0 ? '+' : ''}${m.dominanceChange30d} pp en 30 d`
            : 'variación no disponible',
      },
      {
        label: 'ETH/BTC',
        value: m.ethBtc != null ? m.ethBtc.toFixed(5) : null,
        hint: m.ethBtcChange30d != null ? `${formatPercent(m.ethBtcChange30d)} en 30 d` : undefined,
      },
      {
        label: 'Sobre su media de 50 d',
        value: m.aboveSma50Pct != null ? `${m.aboveSma50Pct}%` : null,
        hint: m.aboveSma200Pct != null ? `${m.aboveSma200Pct}% sobre la de 200 d` : undefined,
      },
      {
        label: 'Cap. sin Bitcoin',
        value: m.marketCapExBtc != null ? formatCompactFromUsd(m.marketCapExBtc) : null,
        hint:
          m.marketCapExBtcEth != null
            ? `${formatCompactFromUsd(m.marketCapExBtcEth)} sin BTC ni ETH`
            : undefined,
      },
      {
        label: 'Volumen en altcoins',
        value: m.altVolumeSharePct != null ? `${m.altVolumeSharePct}%` : null,
        hint: 'del volumen total analizado',
      },
      {
        label: 'Volatilidad media',
        value: m.avgAltVolatility != null ? `${m.avgAltVolatility}%` : null,
        hint: m.btcVolatility != null ? `BTC ${m.btcVolatility.toFixed(0)}%` : undefined,
      },
      {
        label: 'Concentración top 5',
        value: m.top5Concentration != null ? `${(m.top5Concentration * 100).toFixed(0)}%` : null,
        hint: 'del rendimiento total',
      },
    ],
    [m, formatCompactFromUsd],
  );

  return (
    <Card className="!p-4 sm:!p-5">
      <h2 className="text-base font-bold text-primary sm:text-lg">Métricas principales</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {rows.map((r) => (
          <div key={r.label} className="liquid-subcard min-w-0 rounded-xl p-2.5">
            <p className="text-[10px] leading-tight text-muted">{r.label}</p>
            <p className="mt-0.5 truncate font-mono text-sm font-bold text-primary">
              {r.value ?? 'No disp.'}
            </p>
            {r.hint && <p className="truncate text-[10px] leading-tight text-muted">{r.hint}</p>}
          </div>
        ))}
      </div>

      {/* Amplitud detallada */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Breadth label="Positivas 7 d" pct={m.positive7dPct} />
        <Breadth label="Positivas 30 d" pct={m.positive30dPct} />
        <Breadth label="Positivas 90 d" pct={m.positive90dPct} />
        <Breadth label="Sobre media 20 d" pct={m.aboveSma20Pct} />
      </div>

      {(m.near90dHighCount != null || m.drawdown20PlusCount != null) && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {m.near90dHighCount != null &&
            `${m.near90dHighCount} altcoins cotizan a menos de un 5% de su máximo de 90 días. `}
          {m.drawdown20PlusCount != null &&
            `${m.drawdown20PlusCount} han caído más de un 20% desde ese máximo.`}
        </p>
      )}
    </Card>
  );
}

function Breadth({ label, pct }: { label: string; pct: number | null }) {
  const value = pct ?? 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate text-[10px] text-muted">{label}</span>
        <span className="shrink-0 font-mono text-[11px] font-bold text-secondary">
          {pct == null ? '—' : `${pct}%`}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-btc transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

// --- Componentes ------------------------------------------------------------

/**
 * Desglose del score: qué peso ha tenido cada componente y con qué valor. Solo
 * datos; qué mide cada uno, con qué rango se normaliza y qué se excluye está en
 * Ajustes → Información.
 */
function ComponentsCard({ data }: { data: AltseasonResponse }) {
  const [open, setOpen] = useState(false);
  const { result } = data;

  return (
    <Card className="!p-0">
      <details className="group" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block text-sm font-bold text-primary">Componentes del score</span>
            <span className="block text-xs text-muted">Peso efectivo y valor actual</span>
          </span>
          <ChevronDown
            size={18}
            className="shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-3 border-t border-white/10 px-4 py-3">
          <ul className="space-y-1.5">
            {result.components.map((c) => (
              <li
                key={c.label}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">
                  {c.label}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-btc">
                  {c.effectiveWeight}%
                </span>
                <span className="w-full font-mono text-[11px] text-secondary">
                  {c.score == null ? 'sin dato' : `${c.rawValue} → ${c.score}`}
                </span>
              </li>
            ))}
          </ul>

          {result.penalties.length > 0 && (
            <p className="text-[11px] leading-relaxed text-bear">
              Penalizaciones aplicadas:{' '}
              {result.penalties.map((p) => `${p.reason} (−${p.points})`).join('; ')}
            </p>
          )}

          {result.missing.length > 0 && (
            <p className="text-[11px] leading-relaxed text-muted">
              Sin datos ahora mismo: {result.missing.join(', ')}. Su peso se ha repartido entre los
              componentes disponibles.
            </p>
          )}

          <p className="text-[11px] text-muted">
            Analizadas {data.metrics.analyzedCount} altcoins de {formatNumberEs(data.universeSize)}{' '}
            elegibles · {data.excludedCount} excluidas · última actualización{' '}
            {formatDateTimeMadrid(data.observedAt)}.
          </p>
        </div>
      </details>
    </Card>
  );
}
