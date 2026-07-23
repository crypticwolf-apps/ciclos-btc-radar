import type { MarketData } from '@/types';
import { useAltseason } from '@/hooks/useAltseason';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cx, formatDateEs, formatNumberEs, formatPercent } from '@/lib/format';
import { formatGainPct } from '@/lib/format';

// =============================================================================
// Ciclos → Comparativa.
//
// No repite los gráficos de Ciclo BTC ni de Altseason: los RELACIONA. La idea
// es responder a una pregunta concreta: dónde está el ciclo de Bitcoin y dónde
// el de las altcoins, y si van sincronizados o desfasados.
//
// Históricamente la rotación a altcoins llega DESPUÉS del tramo fuerte de BTC,
// así que situar ambos en el mismo cuadro es más informativo que superponer
// series con escalas distintas.
// =============================================================================

export function CyclesComparisonView({ data }: { data: MarketData }) {
  const { formatFromUsd } = useCurrency();
  const alt = useAltseason();
  const altData = alt.data?.data;

  const halving = data.halvingInfo;
  const tech = data.technicals;

  // Posición dentro del ciclo de BTC: del suelo del ciclo a su techo.
  const cycleLow = tech?.cycleLow ?? null;
  const cycleHigh = tech?.cycleHigh ?? null;
  const price = data.bitcoin.precio;
  const posInCycle =
    cycleLow != null && cycleHigh != null && cycleHigh > cycleLow
      ? Math.max(0, Math.min(100, ((price - cycleLow) / (cycleHigh - cycleLow)) * 100))
      : null;

  const fromLow = cycleLow != null && cycleLow > 0 ? ((price - cycleLow) / cycleLow) * 100 : null;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="!p-4 sm:!p-5">
        <h1 className="flex items-center gap-1.5 text-lg font-extrabold text-primary sm:text-xl">
          Bitcoin frente a las altcoins
          <InfoTooltip text="Relaciona en qué punto está el ciclo de Bitcoin (desde su halving y su suelo) con el estado de la rotación hacia altcoins. Históricamente la altseason llega después del tramo fuerte de BTC." />
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-secondary">
          Dos relojes distintos que no marcan la misma hora: el de Bitcoin lo fija el halving y el
          de las altcoins, la rotación de capital.
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Reloj de Bitcoin */}
        <Card className="!p-4 sm:!p-5">
          <h2 className="text-base font-bold text-btc">Ciclo de Bitcoin</h2>
          <div className="mt-3 space-y-2.5">
            <Row label="Días desde el halving" value={formatNumberEs(halving.diasDesdeUltimoHalving)} />
            <Row
              label="Próximo halving"
              value={`en ${formatNumberEs(halving.diasHastaProximoHalving)} días`}
              hint={formatDateEs(halving.proximoHalvingEstimado)}
            />
            <Row label="Suelo del ciclo" value={cycleLow != null ? formatFromUsd(cycleLow) : '—'} />
            <Row label="Máximo del ciclo" value={cycleHigh != null ? formatFromUsd(cycleHigh) : '—'} />
            <Row
              label="Desde el suelo"
              value={fromLow != null ? formatGainPct(Math.round(fromLow)) : '—'}
              tone="bull"
            />
            <Row label="Desde el máximo" value={formatPercent(data.bitcoin.drawdownDesdeAth)} tone="bear" />
          </div>

          {posInCycle != null && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>Suelo</span>
                <span>Posición en el rango del ciclo</span>
                <span>Máximo</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-btc transition-[width] duration-500"
                  style={{ width: `${posInCycle}%` }}
                />
              </div>
              <p className="mt-1 text-center font-mono text-xs font-bold text-btc">
                {posInCycle.toFixed(0)}%
              </p>
            </div>
          )}
        </Card>

        {/* Reloj de las altcoins */}
        <Card className="!p-4 sm:!p-5">
          <h2 className="text-base font-bold text-macro">Ciclo de las altcoins</h2>
          {alt.isLoading ? (
            <Skeleton className="mt-3 h-48" />
          ) : !altData ? (
            <p className="mt-3 text-sm text-muted">
              Datos de altseason no disponibles ahora mismo.
            </p>
          ) : (
            <>
              <div className="mt-3 space-y-2.5">
                <Row
                  label="Altseason Score"
                  value={altData.result.score == null ? 'No disponible' : `${altData.result.score}/100`}
                />
                <Row label="Clasificación" value={altData.result.classification} />
                <Row label="Fase" value={altData.result.phaseLabel} />
                <Row
                  label="Superan a BTC (90 d)"
                  value={
                    altData.metrics.outperform90Pct != null
                      ? `${altData.metrics.outperform90Pct}%`
                      : '—'
                  }
                  hint={
                    altData.metrics.outperformCount != null
                      ? `${altData.metrics.outperformCount} de ${altData.metrics.analyzedCount}`
                      : undefined
                  }
                />
                <Row
                  label="Dominancia de BTC"
                  value={altData.metrics.btcDominance != null ? `${altData.metrics.btcDominance}%` : '—'}
                  hint={
                    altData.metrics.dominanceChange30d != null
                      ? `${altData.metrics.dominanceChange30d >= 0 ? '+' : ''}${altData.metrics.dominanceChange30d} pp en 30 d`
                      : undefined
                  }
                />
                <Row
                  label="ETH/BTC (30 d)"
                  value={
                    altData.metrics.ethBtcChange30d != null
                      ? formatPercent(altData.metrics.ethBtcChange30d)
                      : '—'
                  }
                  tone={(altData.metrics.ethBtcChange30d ?? 0) >= 0 ? 'bull' : 'bear'}
                />
              </div>

              {altData.result.score != null && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-[11px] text-muted">
                    <span>Domina BTC</span>
                    <span>Rotación</span>
                    <span>Altseason</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-macro transition-[width] duration-500"
                      style={{ width: `${altData.result.score}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center font-mono text-xs font-bold text-macro">
                    {altData.result.score}%
                  </p>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Lectura conjunta */}
      {altData && (
        <Card className="!p-4 sm:!p-5">
          <h2 className="text-base font-bold text-primary">Lectura conjunta</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            {buildJointReading(
              halving.diasDesdeUltimoHalving,
              posInCycle,
              altData.result.score,
              altData.result.classification,
            )}
          </p>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            El patrón histórico —altseason tras el tramo fuerte de Bitcoin— se ha repetido en los
            ciclos de 2017 y 2021, lo que no garantiza que vuelva a ocurrir. Esta lectura describe
            la situación actual; no es una previsión ni una recomendación.
          </p>
        </Card>
      )}

      <Card className="!p-4 sm:!p-5">
        <h2 className="text-base font-bold text-primary">Comparación con ciclos anteriores</h2>
        <p className="mt-1 text-xs text-muted">
          Rendimiento de Bitcoin del suelo al techo de cada ciclo, con datos reales de cierre diario.
        </p>
        <div className="mt-3 space-y-2">
          {data.halvings.map((h) => (
            <div key={h.year} className="liquid-subcard rounded-xl p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-primary">Ciclo {h.year}</span>
                <span className="font-mono text-sm font-bold text-bull">
                  {h.sueloAPicoPct == null ? '—' : formatGainPct(h.sueloAPicoPct)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                {h.sueloCiclo != null ? formatFromUsd(h.sueloCiclo) : '—'} →{' '}
                {h.picoCiclo != null ? formatFromUsd(h.picoCiclo) : 'en curso'}
                {h.picoFecha && ` · techo en ${formatDateEs(h.picoFecha)}`}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Cada ciclo ha rendido menos que el anterior. No existe una serie gratuita de dominancia ni
          de amplitud de altcoins que llegue a 2017, así que la comparativa de ciclos de altcoins se
          limita al ciclo actual.
        </p>
      </Card>
    </div>
  );
}

function buildJointReading(
  daysSinceHalving: number,
  posInCycle: number | null,
  altScore: number | null,
  altLabel: string,
): string {
  const btcPart =
    posInCycle == null
      ? `Han pasado ${formatNumberEs(daysSinceHalving)} días desde el último halving.`
      : posInCycle > 75
        ? `Bitcoin cotiza en la parte alta del rango de su ciclo (${posInCycle.toFixed(0)}%), a ${formatNumberEs(daysSinceHalving)} días del halving.`
        : posInCycle < 35
          ? `Bitcoin cotiza en la parte baja del rango de su ciclo (${posInCycle.toFixed(0)}%), a ${formatNumberEs(daysSinceHalving)} días del halving.`
          : `Bitcoin está en la zona media del rango de su ciclo (${posInCycle.toFixed(0)}%), a ${formatNumberEs(daysSinceHalving)} días del halving.`;

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

function Row({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'bull' | 'bear';
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="min-w-0 text-xs text-muted">{label}</span>
      <span className="shrink-0 text-right">
        <span
          className={cx(
            'block font-mono text-sm font-bold',
            tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : 'text-primary',
          )}
        >
          {value}
        </span>
        {hint && <span className="block text-[10px] text-muted">{hint}</span>}
      </span>
    </div>
  );
}
