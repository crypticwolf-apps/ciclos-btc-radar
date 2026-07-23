import { ArrowRight } from 'lucide-react';
import { useAltseason } from '@/hooks/useAltseason';
import { altseasonColor } from '@/lib/altseason/score';
import { cx } from '@/lib/format';

// =============================================================================
// Resumen MÍNIMO de Altseason para la pantalla de inicio.
//
// Deliberadamente no muestra gráficos, metodología ni el desglose de métricas:
// es solo un acceso de una línea. Todo eso vive en Ciclos → Altseason.
// =============================================================================

export function AltseasonMiniSummary({ onOpen }: { onOpen: () => void }) {
  const { data, isLoading } = useAltseason();
  const result = data?.data?.result;

  // Mientras carga o si no hay dato, no se ocupa sitio en la pantalla de inicio.
  if (isLoading || !result) return null;

  const score = result.score;
  const color = score != null ? altseasonColor(score) : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={
        score != null
          ? `Altseason ${score} de 100, ${result.classification}. Abrir el análisis completo.`
          : 'Altseason Score no disponible. Abrir el análisis completo.'
      }
      className="glass liquid-card flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left"
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-xs font-semibold text-muted">Altseason</span>
        {score != null ? (
          <>
            <span className="shrink-0 font-mono text-base font-extrabold tabular-nums" style={{ color }}>
              {score}
              <span className="text-xs font-normal text-muted">/100</span>
            </span>
            <span className="truncate text-xs text-secondary">· {result.classification}</span>
          </>
        ) : (
          <span className="truncate text-xs text-muted">no disponible</span>
        )}
      </span>
      <ArrowRight size={16} className={cx('shrink-0 text-muted')} aria-hidden="true" />
    </button>
  );
}
