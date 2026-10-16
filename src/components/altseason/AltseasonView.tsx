import { useMemo, type ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useLiveAltseason } from '@/hooks/useLiveAltseason';
import { useEnVista } from '@/hooks/useEnVista';
import { useCurrency } from '@/contexts/CurrencyContext';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { NoDisponible, SummaryCard } from './AltseasonResumenCard';
import { AltseasonRanking } from './AltseasonRanking';
import { Columnas } from '@/components/layout/Columnas';
import { CategoriesCard } from './CategoriesCard';
import { AltseasonBreadthChart } from './AltseasonBreadthChart';
import type { AltseasonResponse } from '@/types/altseason';
import { cx, formatDateTimeMadrid, formatNumberEs, formatPercent } from '@/lib/format';

// =============================================================================
// Ciclos → Altseason.
//
// Pantalla centrada en las SEÑALES: el marcador arriba y, justo debajo, las
// señales a favor y en contra de la rotación hacia altcoins, que es lo que hay
// que leer. Las métricas, la amplitud, el ranking y el desglose siguen aquí
// porque son datos, pero empiezan plegados.
//
// Todo lo explicativo —qué significa cada fase del ciclo de altcoins, qué haría
// falta para avanzar o retroceder, qué dice cada tramo del marcador, la
// metodología y las fuentes— vive en Ajustes → Información.
// =============================================================================

export function AltseasonView() {
  // El análisis entero con los precios en vivo: el marcador, la amplitud y el
  // ranking se mueven cada 5 s mientras esta pantalla está abierta.
  const { query, data, prices } = useLiveAltseason(true);
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

  if (!data) return <NoDisponible nota={meta?.note} />;

  // En el orden del móvil. En escritorio estos cuadros van sueltos en la hoja
  // única (views/HojaEscritorio), cada uno con `CuadroAltseason`.
  return (
    <Columnas
      items={[
        { clave: 'resumen', nodo: <SummaryCard data={data} status={meta?.status} live={prices} /> },
        { clave: 'senales', nodo: <SignalsCards data={data} /> },
        { clave: 'metricas', nodo: <MetricsCard data={data} /> },
        { clave: 'categorias', nodo: <CategoriesCard /> },
        { clave: 'amplitud', nodo: <AltseasonBreadthChart points={data.breadthHistory} /> },
        { clave: 'ranking', nodo: <AltseasonRanking rows={data.ranking} live={prices} /> },
        { clave: 'componentes', nodo: <ComponentsCard data={data} /> },
      ]}
    />
  );
}

export type ParteAltseason =
  | 'senales-favor'
  | 'senales-contra'
  | 'metricas'
  | 'categorias'
  | 'amplitud'
  | 'ranking'
  | 'componentes';

/**
 * Un cuadro del Altseason por su cuenta, para la hoja de escritorio: cada uno se
 * apunta a la misma consulta (no repite peticiones) y pide los precios en vivo
 * solo mientras se ve. Sin datos no ocupan sitio: ya lo explica el resumen
 * (`AltseasonResumen`).
 */
export function CuadroAltseason({ parte }: { parte: ParteAltseason }) {
  const [ref, enVista] = useEnVista<HTMLDivElement>();
  const { query, data, prices } = useLiveAltseason(enVista);

  let contenido: ReactNode = null;
  if (query.isLoading) contenido = <Skeleton className="h-[240px]" />;
  else if (!data) contenido = null;
  else if (parte === 'senales-favor') contenido = <SignalList {...senales(data).favor} />;
  else if (parte === 'senales-contra') contenido = <SignalList {...senales(data).contra} />;
  else if (parte === 'metricas') contenido = <MetricsCard data={data} />;
  else if (parte === 'categorias') contenido = <CategoriesCard />;
  else if (parte === 'amplitud') contenido = <AltseasonBreadthChart points={data.breadthHistory} />;
  else if (parte === 'ranking') contenido = <AltseasonRanking rows={data.ranking} live={prices} />;
  else contenido = <ComponentsCard data={data} />;

  // El contenedor existe siempre, para que el observador de visibilidad tenga
  // algo que mirar desde el primer momento.
  return <div ref={ref}>{contenido}</div>;
}

// --- Señales ----------------------------------------------------------------

function senales(data: AltseasonResponse) {
  const { signalsFor, signalsAgainst } = data.result;
  return {
    favor: {
      title: 'Señales a favor',
      icon: <TrendingUp size={16} className="text-bull" />,
      signals: signalsFor,
      tone: 'bull' as const,
      empty: 'Ninguna señal apoya una rotación hacia altcoins ahora mismo.',
    },
    contra: {
      title: 'Señales en contra',
      icon: <TrendingDown size={16} className="text-bear" />,
      signals: signalsAgainst,
      tone: 'bear' as const,
      empty: 'Ninguna señal contradice la rotación ahora mismo.',
    },
  };
}

function SignalsCards({ data }: { data: AltseasonResponse }) {
  const { favor, contra } = senales(data);
  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
      <SignalList {...favor} />
      <SignalList {...contra} />
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
    <CollapsibleCard
      title={title}
      titleClassName="text-primary"
      icon={icon}
      badge={
        <span
          className={cx(
            'inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-xs font-bold',
            tone === 'bull' ? 'border-bull/40 bg-bull/10 text-bull' : 'border-bear/40 bg-bear/10 text-bear',
          )}
        >
          {signals.length}
        </span>
      }
    >
      {signals.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
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
    </CollapsibleCard>
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
            ? `${m.outperformCount} de ${m.analyzedCount} (${formatNumberEs(m.outperform90Pct, 1)}%)`
            : null,
        hint: m.btcReturn90 != null ? `BTC ${formatPercent(m.btcReturn90)} en 90 d` : undefined,
      },
      {
        label: 'Dominancia de Bitcoin',
        value: m.btcDominance != null ? `${formatNumberEs(m.btcDominance, 2)}%` : null,
        hint:
          m.dominanceChange30d != null
            ? `${m.dominanceChange30d >= 0 ? '+' : '−'}${formatNumberEs(Math.abs(m.dominanceChange30d), 2)} pp en 30 d`
            : 'variación no disponible',
      },
      {
        label: 'ETH/BTC',
        value: m.ethBtc != null ? formatNumberEs(m.ethBtc, 5) : null,
        hint: m.ethBtcChange30d != null ? `${formatPercent(m.ethBtcChange30d)} en 30 d` : undefined,
      },
      {
        label: 'Sobre su media de 50 d',
        value: m.aboveSma50Pct != null ? `${formatNumberEs(m.aboveSma50Pct, 1)}%` : null,
        hint: m.aboveSma200Pct != null ? `${formatNumberEs(m.aboveSma200Pct, 1)}% sobre la de 200 d` : undefined,
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
        value: m.altVolumeSharePct != null ? `${formatNumberEs(m.altVolumeSharePct, 1)}%` : null,
        hint: 'del volumen total analizado',
      },
      {
        label: 'Volatilidad media',
        value: m.avgAltVolatility != null ? `${formatNumberEs(m.avgAltVolatility, 1)}%` : null,
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
    <CollapsibleCard title="Métricas principales" titleClassName="text-primary">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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
    </CollapsibleCard>
  );
}

function Breadth({ label, pct }: { label: string; pct: number | null }) {
  const value = pct ?? 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate text-[10px] text-muted">{label}</span>
        <span className="shrink-0 font-mono text-[11px] font-bold text-secondary">
          {pct == null ? '—' : `${formatNumberEs(pct, 1)}%`}
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
  const { result } = data;

  return (
    <CollapsibleCard
      title="Componentes del score"
      subtitle="Peso efectivo y valor actual"
      titleClassName="text-primary"
    >
      <div className="space-y-3">
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
    </CollapsibleCard>
  );
}
