import { cx, timeAgo } from '@/lib/format';

// =============================================================================
// Etiqueta de frescura: la ÚNICA forma admitida de decirle al usuario cuánto se
// puede fiar de un número.
//
// La regla que impone este componente es que la etiqueta describe la FRECUENCIA
// REAL de la fuente, no lo reciente que sea nuestra última consulta. Un índice
// que se publica una vez al día es "Diario" aunque acabemos de pedirlo hace dos
// segundos; llamarlo "En vivo" sería mentir.
//
//   En vivo     WebSocket abierto y recibiendo: cambia solo, al instante.
//   Actualizado Consulta REST reciente de una fuente que sí cambia a menudo.
//   Retrasado   La fuente va lenta o el último intento falló y seguimos con el
//               dato anterior, que aún es válido.
//   Diario      La fuente publica una vez al día (Fear & Greed, on-chain…).
//   Caché       Estamos mostrando el último dato bueno porque la API falla.
//   No disp.    No hay dato y no se inventa ninguno.
// =============================================================================

export type Freshness = 'vivo' | 'actualizado' | 'retrasado' | 'diario' | 'cache' | 'no-disponible';

const STYLES: Record<Freshness, { label: string; dot: string; text: string }> = {
  vivo: { label: 'En vivo', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  actualizado: { label: 'Actualizado', dot: 'bg-sky-500', text: 'text-sky-400' },
  retrasado: { label: 'Retrasado', dot: 'bg-amber-500', text: 'text-amber-400' },
  diario: { label: 'Diario', dot: 'bg-violet-400', text: 'text-violet-300' },
  cache: { label: 'En caché', dot: 'bg-zinc-400', text: 'text-zinc-300' },
  'no-disponible': { label: 'No disponible', dot: 'bg-red-500', text: 'text-red-400' },
};

interface FreshnessTagProps {
  freshness: Freshness;
  /** Fecha REAL del dato (no de la consulta). */
  at?: string | number | Date | null;
  /** Nombre de la fuente, para el título accesible. */
  source?: string;
  /** Oculta el "hace X" y deja solo el estado. */
  compact?: boolean;
  className?: string;
}

export function FreshnessTag({ freshness, at, source, compact, className }: FreshnessTagProps) {
  const style = STYLES[freshness];
  const date = at == null ? null : at instanceof Date ? at : new Date(at);
  const valid = date && !Number.isNaN(date.getTime());
  // "En vivo" ya implica ahora mismo: añadir "hace un momento" sobra.
  const showAge = !compact && valid && freshness !== 'vivo';

  return (
    <span
      className={cx('inline-flex items-center gap-1.5 text-xs', style.text, className)}
      title={source ? `Fuente: ${source}` : undefined}
    >
      <span
        className={cx(
          'h-2 w-2 shrink-0 rounded-full',
          style.dot,
          freshness === 'vivo' && 'motion-safe:animate-pulse',
        )}
        aria-hidden="true"
      />
      <span className="font-semibold">{style.label}</span>
      {showAge && <span className="text-muted">· {timeAgo(date!)}</span>}
    </span>
  );
}

/** Traduce el estado del envelope del backend a una etiqueta de frescura.
 *  `daily` fuerza "Diario" para fuentes que solo publican una vez al día. */
export function freshnessFromStatus(
  status: string | undefined,
  options: { daily?: boolean } = {},
): Freshness {
  if (status === 'unavailable' || status == null) return 'no-disponible';
  if (status === 'stale') return options.daily ? 'diario' : 'cache';
  if (options.daily) return 'diario';
  if (status === 'live' || status === 'cached') return 'actualizado';
  return 'retrasado';
}
