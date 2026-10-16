import type { MarketData } from '@/types';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { BarraMiedoCodicia } from '@/components/ui/BarraMiedoCodicia';
import { ZONAS_MIEDO_CODICIA, zonaMiedoCodicia } from '@/lib/sentiment/miedoCodicia';
import { cx } from '@/lib/format';

/**
 * El índice de miedo y codicia en su barra líquida, con la comparativa con los
 * mínimos históricos. En el móvil va en Análisis; en escritorio, arriba del todo.
 */
export function MiedoCodiciaCard({ data }: { data: MarketData }) {
  const { indicators } = data;
  // El índice puede faltar: en ese caso no se pinta un 50 de relleno.
  const fearGreed = indicators.fearGreed;
  // El color de la etiqueta, el de su zona en la barra.
  const fg = ZONAS_MIEDO_CODICIA[zonaMiedoCodicia(fearGreed ?? 50, indicators.fearGreedLabel)]!;
  // Referencia para el ancho de las barras comparativas. El valor actual entra
  // en vivo y puede superar a todos los mínimos históricos, así que la escala
  // se toma del máximo real de la serie (mínimo 25 para no exagerar valores bajos).
  const fearGreedScale = Math.max(25, ...data.fearGreedHistory.map((e) => e.value));

  // Con id: el botón «Ver sentimiento del mercado» de Inicio lleva directo aquí.
  return (
    <CollapsibleCard
      id="miedo-codicia"
      title="Fear & Greed Index"
      subtitle="Sentimiento agregado del mercado (0 = pánico, 100 = euforia)"
      info="Índice diario de alternative.me. Resume volatilidad, volumen, redes sociales y dominancia en un solo número: 0 es pánico y 100, euforia."
      // La cifra va en la cabecera: es EL dato de la tarjeta y así se lee sin
      // abrirla.
      badge={
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold"
          style={{ color: fg.color, borderColor: `${fg.color}66`, background: `${fg.color}1a` }}
        >
          <span className="font-mono text-sm">{fearGreed ?? '—'}</span>
          {indicators.fearGreedLabel ?? 'Sin dato'}
        </span>
      }
    >
      {fearGreed == null ? (
        <p className="py-6 text-center text-sm text-muted">
          El índice de miedo y codicia no está disponible ahora mismo.
        </p>
      ) : (
        <BarraMiedoCodicia valor={fearGreed} etiqueta={indicators.fearGreedLabel} />
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-secondary sm:text-sm">
          Comparativa con mínimos históricos
        </p>
        <div className="space-y-1.5">
          {data.fearGreedHistory.map((e) => (
            <div key={e.event} className="flex items-center gap-2 sm:gap-3">
              <span className="w-20 shrink-0 text-[11px] text-muted sm:w-28 sm:text-xs">{e.event}</span>
              <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-white/5 sm:h-5">
                <div
                  className={cx('flex h-full min-w-0 items-center justify-end overflow-hidden rounded-full pr-2 text-[10px] font-bold text-white transition-all', e.highlight && 'ring-2 ring-white/60')}
                  style={{
                    // La escala se calcula sobre el máximo REAL de la serie, no
                    // sobre un 25 fijo: el valor actual llega en vivo y puede
                    // superarlo, y entonces la barra se salía del contenedor.
                    width: `${Math.min(100, (e.value / fearGreedScale) * 100)}%`,
                    background: e.highlight ? '#f59e0b' : '#ef4444',
                  }}
                >
                  {e.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleCard>
  );
}
