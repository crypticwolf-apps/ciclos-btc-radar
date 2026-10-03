import type { MarketData } from '@/types';
import { useLiveAltseason } from '@/hooks/useLiveAltseason';
import { useCurrency } from '@/contexts/CurrencyContext';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { cx, formatGainPct, formatNumberEs, formatPercent } from '@/lib/format';

// =============================================================================
// Ciclos → Comparativa.
//
// Solo lo que NO está en otra pantalla:
//   1. Dónde está cada ciclo — Bitcoin en el rango de su ciclo y las altcoins
//      en su rotación, uno al lado del otro, con una lectura de si van
//      sincronizados o desfasados.
//   2. El ciclo actual frente a los anteriores en el MISMO punto: a los días
//      que lleva el último halving, cómo iba cada ciclo.
//
// Antes esta pantalla repetía los días al halving y la caída desde el máximo
// (ya en Ciclo BTC y Análisis), las seis cifras de Altseason, y una lista de
// rendimientos suelo → techo idéntica al histórico de halvings. La explicación
// de por qué comparar los dos relojes está en Ajustes → Información.
// =============================================================================

export function CyclesComparisonView({ data }: { data: MarketData }) {
  const { formatFromUsd } = useCurrency();
  // El mismo marcador en vivo que en Altseason, para que las dos cifras coincidan.
  const { query: alt, data: altData } = useLiveAltseason(true);

  const tech = data.technicals;
  const cycleLow = tech?.cycleLow ?? null;
  const cycleHigh = tech?.cycleHigh ?? null;
  const price = data.bitcoin.precio;
  const posInCycle =
    cycleLow != null && cycleHigh != null && cycleHigh > cycleLow
      ? Math.max(0, Math.min(100, ((price - cycleLow) / (cycleHigh - cycleLow)) * 100))
      : null;
  const fromLow = cycleLow != null && cycleLow > 0 ? ((price - cycleLow) / cycleLow) * 100 : null;
  const altScore = altData?.result.score ?? null;

  return (
    <div className="space-y-3 sm:space-y-4">
      <CollapsibleCard
        title="Dónde está cada ciclo"
        titleClassName="text-primary"
        subtitle="Bitcoin en el rango de su ciclo y las altcoins en su rotación"
        info="Dos relojes distintos: el de Bitcoin lo marca el halving y su recorrido del suelo al máximo; el de las altcoins, la rotación de capital (Altseason Score). Cómo se leen juntos, en Ajustes → Información."
      >
        <div className="space-y-4">
          <Barra
            titulo="Bitcoin"
            valor={posInCycle}
            color="bg-btc"
            texto="text-btc"
            izquierda="Suelo"
            derecha="Máximo"
            detalle={
              cycleLow != null && cycleHigh != null
                ? `${formatFromUsd(cycleLow)} → ${formatFromUsd(cycleHigh)}${fromLow != null ? ` · hoy ${formatGainPct(Math.round(fromLow))} sobre el suelo` : ''}`
                : 'Rango del ciclo no disponible'
            }
          />

          {alt.isLoading ? (
            <Skeleton className="h-16" />
          ) : (
            <Barra
              titulo="Altcoins"
              valor={altScore}
              color="bg-macro"
              texto="text-macro"
              izquierda="Domina BTC"
              derecha="Altseason"
              detalle={
                altData
                  ? `${altData.result.classification} · ${altData.result.phaseLabel}`
                  : 'Datos de altseason no disponibles ahora mismo'
              }
            />
          )}

          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-secondary">
            {buildJointReading(
              data.halvingInfo.diasDesdeUltimoHalving,
              posInCycle,
              altScore,
              altData?.result.classification ?? '',
            )}
          </p>
        </div>
      </CollapsibleCard>

      <SamePointCard data={data} />
    </div>
  );
}

// --- El mismo punto de cada ciclo ---------------------------------------------

function SamePointCard({ data }: { data: MarketData }) {
  const { formatFromUsd } = useCurrency();
  const filas = data.halvings.filter((h) => h.mismoPunto);
  const dias = filas[0]?.mismoPunto?.dias ?? null;
  if (filas.length < 2 || dias == null) return null;

  // Escala común de las barras: el mayor rendimiento desde el halving.
  const max = Math.max(...filas.map((h) => Math.abs(h.mismoPunto!.desdeHalvingPct ?? 0)), 1);

  return (
    <CollapsibleCard
      title="A la misma altura del ciclo"
      titleClassName="text-primary"
      subtitle={`Cómo iba cada ciclo ${formatNumberEs(dias)} días después de su halving, los mismos que lleva el actual`}
      info="Compara ciclos en el mismo punto de su reloj en lugar de suelo contra techo: rendimiento desde el precio del día del halving y distancia al techo de ese ciclo, si ya se había alcanzado. Cuatro ciclos son una muestra pequeña: es contexto, no un objetivo de precio."
    >
      <ul className="space-y-2">
        {filas.map((h) => {
          const p = h.mismoPunto!;
          const actual = !h.halvingEstimado && h.fecha === data.halvingInfo.ultimoHalving?.fecha;
          const pct = p.desdeHalvingPct;
          return (
            <li
              key={h.year}
              className={cx('rounded-xl border p-2.5', actual ? 'border-btc/40 bg-btc/5' : 'border-white/10 bg-white/5')}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold text-primary">
                  Ciclo {h.year}
                  {actual && <span className="ml-1.5 text-[10px] font-semibold uppercase text-btc">hoy</span>}
                </span>
                <span className={cx('font-mono text-sm font-bold', pct == null ? 'text-muted' : pct >= 0 ? 'text-bull' : 'text-bear')}>
                  {pct == null ? '—' : formatGainPct(pct)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cx('h-full rounded-full', pct != null && pct < 0 ? 'bg-bear' : actual ? 'bg-btc' : 'bg-bull/70')}
                  style={{ width: `${pct == null ? 0 : Math.max(2, (Math.abs(pct) / max) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] leading-tight text-muted">
                {formatFromUsd(p.precio)} el {new Date(p.fecha).toLocaleDateString('es-ES')}
                {' · '}
                {p.desdeTechoPct == null ? 'techo aún por llegar' : `${formatPercent(p.desdeTechoPct)} desde su techo`}
              </p>
            </li>
          );
        })}
      </ul>
    </CollapsibleCard>
  );
}

// --- Piezas ------------------------------------------------------------------

function Barra({
  titulo,
  valor,
  color,
  texto,
  izquierda,
  derecha,
  detalle,
}: {
  titulo: string;
  valor: number | null;
  color: string;
  texto: string;
  izquierda: string;
  derecha: string;
  detalle: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-secondary">{titulo}</span>
        <span className={cx('font-mono text-sm font-bold', valor == null ? 'text-muted' : texto)}>
          {valor == null ? '—' : `${valor.toFixed(0)}%`}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${valor ?? 0}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{izquierda}</span>
        <span>{derecha}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{detalle}</p>
    </div>
  );
}

function buildJointReading(
  daysSinceHalving: number | null,
  posInCycle: number | null,
  altScore: number | null,
  altLabel: string,
): string {
  // Sin fecha del último halving la frase se escribe sin ella, en vez de decir
  // «a — días del halving».
  const desdeHalving =
    daysSinceHalving == null ? '' : `, a ${formatNumberEs(daysSinceHalving)} días del halving`;
  const btcPart =
    posInCycle == null
      ? daysSinceHalving == null
        ? 'No hay suficientes datos para situar a Bitcoin dentro de su ciclo.'
        : `Han pasado ${formatNumberEs(daysSinceHalving)} días desde el último halving.`
      : posInCycle > 75
        ? `Bitcoin cotiza en la parte alta del rango de su ciclo (${posInCycle.toFixed(0)}%)${desdeHalving}.`
        : posInCycle < 35
          ? `Bitcoin cotiza en la parte baja del rango de su ciclo (${posInCycle.toFixed(0)}%)${desdeHalving}.`
          : `Bitcoin está en la zona media del rango de su ciclo (${posInCycle.toFixed(0)}%)${desdeHalving}.`;

  if (altScore == null) {
    return `${btcPart} El estado de la rotación hacia altcoins no se puede evaluar ahora mismo por falta de datos.`;
  }

  const altPart =
    altScore >= 61
      ? `La rotación hacia altcoins ya está en marcha (${altScore}/100, ${altLabel.toLowerCase()}).`
      : altScore >= 41
        ? `La rotación hacia altcoins está a medias (${altScore}/100, ${altLabel.toLowerCase()}).`
        : `El capital sigue concentrado en Bitcoin (${altScore}/100, ${altLabel.toLowerCase()}).`;

  const sync =
    posInCycle != null && posInCycle > 70 && altScore < 41
      ? ' Los dos relojes van desfasados: Bitcoin arriba en su rango pero sin que el capital haya rotado todavía.'
      : posInCycle != null && posInCycle < 40 && altScore >= 61
        ? ' Llama la atención el desfase: hay rotación hacia altcoins con Bitcoin en la parte baja de su rango.'
        : '';

  return `${btcPart} ${altPart}${sync}`;
}
