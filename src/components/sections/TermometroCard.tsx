import type { MarketData } from '@/types';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { EtiquetaContexto, TermometroCristal } from '@/components/ui/TermometroCristal';
import { useScoreHistory } from '@/hooks/useScoreHistory';
import { snapshotHace } from '@/lib/score/snapshot';
import { cx, formatNumberEs, formatPercent } from '@/lib/format';

const CONFIANZA_TEXTO: Record<string, string> = {
  alta: 'Todas o casi todas las fuentes han respondido.',
  media: 'Falta alguna fuente; los pesos se han redistribuido entre las disponibles.',
  baja: 'Faltan varias fuentes: el resultado es orientativo.',
};

/**
 * «Temperatura del mercado»: el termómetro con su resumen, la confianza del
 * cálculo y la escala. En el móvil abre la pestaña Temperatura; en escritorio va
 * arriba del todo, con lo esencial.
 */
export function TermometroCard({ data }: { data: MarketData }) {
  const { opportunity, bitcoin, indicators } = data;
  // Score de hace 7 días para la marca del termómetro (la misma consulta que
  // la tarjeta del histórico: no hace otra petición). Sin histórico, sin marca.
  const historial = useScoreHistory().data?.data;
  const hace7 = historial?.configured ? (snapshotHace(historial.days, 7)?.score ?? null) : null;

  return (
    <CollapsibleCard
      title="Temperatura del mercado"
      subtitle="Frío = oportunidad · Caliente = riesgo"
      titleClassName="text-primary"
      // Plegada, la cabecera dice la cifra y el contexto; abierta lo dice el termómetro.
      badge={<EtiquetaContexto opportunity={opportunity} />}
      badgeSoloCerrada
    >
      <div className="relative flex flex-col items-center gap-4">
        <div className="text-center">
          <p className="max-w-xl text-sm leading-relaxed text-secondary">
            {opportunity.resumen}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] text-muted">
              RSI {indicators.rsi == null ? '—' : formatNumberEs(indicators.rsi, 1)} · F&amp;G {indicators.fearGreed ?? '—'} ·{' '}
              {formatPercent(bitcoin.drawdownDesdeAth)} ATH
            </span>
          </div>
        </div>
        <TermometroCristal opportunity={opportunity} hace7={hace7} />
      </div>

      {/* Confianza y cobertura: nunca se presenta el número como certeza. */}
      <div className="relative mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center">
        <span className="text-xs font-semibold text-secondary">
          Confianza{' '}
          <span
            className={cx(
              opportunity.confianza === 'alta'
                ? 'text-bull'
                : opportunity.confianza === 'media'
                  ? 'text-btc'
                  : 'text-bear',
            )}
          >
            {opportunity.confianza}
          </span>
        </span>
        <span className="text-[11px] text-muted">
          {opportunity.bloquesDisponibles} de {opportunity.bloquesTotales} bloques ·{' '}
          {opportunity.cobertura}% del peso
        </span>
        <span className="w-full text-[11px] leading-tight text-muted">
          {CONFIANZA_TEXTO[opportunity.confianza]}
          {opportunity.faltantes.length > 0 && ` Sin datos: ${opportunity.faltantes.join(', ')}.`}
        </span>
      </div>

      <p className="relative mt-3 text-center text-[10px] text-muted sm:text-xs">
        0 = frío, contexto más favorable · 100 = caliente, riesgo máximo
      </p>
    </CollapsibleCard>
  );
}
