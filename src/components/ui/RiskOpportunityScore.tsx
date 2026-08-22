import { useEffect, useId, useState } from 'react';
import type { OpportunityScore } from '@/types';
import { scoreColor } from '@/lib/score/opportunityScore';

// =============================================================================
// Termómetro de oportunidad: arco de 180° con aguja.
//
// El relieve se construye por capas, de atrás hacia delante, igual que el
// marcador de Altseason:
//
//   1. canal      → arco ancho y oscuro con sombra propia: el hueco donde se
//                   aloja la cinta, para que la cinta parezca encajada y no
//                   dibujada encima;
//   2. cinta      → arco de color con degradado vertical (claro arriba, oscuro
//                   abajo), que es lo que convierte una línea plana en un tubo;
//   3. recorrido  → el tramo de 0 al score se ilumina con un halo de su propio
//                   color, así el valor se lee en el arco y no solo en la aguja;
//   4. reflejo    → arco fino y blanco por el borde superior de la cinta;
//   5. aguja      → polígono que se estrecha hacia la punta, con una cara clara
//                   y otra oscura, sombra proyectada sobre el arco y un eje con
//                   degradado radial descentrado (la luz entra por arriba a la
//                   izquierda, como en el resto de la interfaz).
//
// El SVG conserva su relación de aspecto (nada de `preserveAspectRatio="none"`),
// así que los degradados radiales y los círculos no se deforman al escalar.
//
// Los `id` de degradados y filtros se generan con `useId`. Con identificadores
// fijos, dos medidores en la misma página comparten definiciones —el navegador
// resuelve siempre el primero del documento— y los filtros se aplican con la
// escala del OTRO svg: el arco iluminado sale gigante y desplazado, y todas las
// agujas se pintan del color del primero.
// =============================================================================

const CENTER_X = 120;
const CENTER_Y = 112;
const NEEDLE_LENGTH = 74;
/** Radio de la línea media de la cinta. */
const ARC_RADIUS = 96;

export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0));
}

function pointAt(score: number, radius: number) {
  const angle = Math.PI + (clampScore(score) / 100) * Math.PI;
  return {
    x: CENTER_X + radius * Math.cos(angle),
    y: CENTER_Y + radius * Math.sin(angle),
  };
}

export function scoreToNeedlePoint(score: number) {
  return pointAt(score, NEEDLE_LENGTH);
}

/**
 * Trazado del arco entre dos valores del 0-100, en sentido horario. Las
 * coordenadas se redondean a dos decimales: el seno y el coseno dejan colas de
 * 16 dígitos que no aportan nada al dibujo y engordan el DOM en cada fotograma
 * de la animación.
 */
export function arcPath(from: number, to: number, radius = ARC_RADIUS): string {
  const round = (v: number) => Number(v.toFixed(2));
  const start = pointAt(from, radius);
  const end = pointAt(to, radius);
  // El indicador recorre 180° en total, así que ningún tramo puede superar media
  // circunferencia: `large-arc-flag` es SIEMPRE 0. Con 1, el navegador dibuja el
  // arco por el camino largo —la otra mitad del círculo— y el tramo iluminado
  // sale despedido fuera del medidor, que es exactamente lo que pasaba cuando
  // este flag se activaba a partir de 50 (que son 90°, no 180°).
  return `M ${round(start.x)} ${round(start.y)} A ${radius} ${radius} 0 0 1 ${round(end.x)} ${round(end.y)}`;
}

/** ¿El usuario ha pedido reducir el movimiento en su sistema? */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function RiskOpportunityScore({ opportunity }: RiskOpportunityScoreProps) {
  const score = clampScore(opportunity.score);
  const color = scoreColor(score);
  const [animated, setAnimated] = useState(0);
  // Prefijo propio de esta instancia para las definiciones del SVG.
  const uid = useId().replace(/:/g, '');
  const ids = {
    gradient: `${uid}-gradient`,
    volume: `${uid}-volume`,
    sheen: `${uid}-sheen`,
    hub: `${uid}-hub`,
    needle: `${uid}-needle`,
    groove: `${uid}-groove`,
    glow: `${uid}-glow`,
    shadow: `${uid}-shadow`,
  };

  useEffect(() => {
    // Sin animación si el usuario la ha desactivado o si la pestaña está
    // oculta: ahí el navegador congela requestAnimationFrame y el medidor se
    // quedaría marcando 0 indefinidamente, que es peor que no animar.
    if (prefersReducedMotion() || (typeof document !== 'undefined' && document.hidden)) {
      setAnimated(score);
      return;
    }

    let raf = 0;
    const startedAt = performance.now();
    const from = animated;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 800);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(from + (score - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Red de seguridad: si la pestaña se oculta a mitad de la animación, al
    // volver el valor debe ser el correcto aunque el bucle se cortara.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        setAnimated(score);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // La animación parte del valor visible y solo se reinicia si cambia el score.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const needle = scoreToNeedlePoint(animated);
  const rounded = Math.round(animated);

  // Base de la aguja: dos puntos separados a ambos lados del eje, para que el
  // polígono se estreche desde el eje hasta la punta.
  const baseLeft = pointAt(clampScore(animated) - 26, 9);
  const baseRight = pointAt(clampScore(animated) + 26, 9);

  return (
    <div
      role="meter"
      aria-label="Termómetro de oportunidad"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(score)}
      aria-valuetext={`${Math.round(score)} de 100, ${opportunity.etiqueta}`}
      className="w-full max-w-[340px] shrink-0"
    >
      <svg
        viewBox="0 0 240 126"
        className="block h-auto w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Color a lo largo del recorrido: rojo → ámbar → verde */}
          <linearGradient id={ids.gradient} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="48%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>

          {/* Volumen del tubo: luz arriba, sombra abajo */}
          <linearGradient id={ids.volume} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
          </linearGradient>

          {/* Reflejo del borde superior */}
          <linearGradient id={ids.sheen} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Eje de la aguja: metálico, con la luz entrando por arriba a la izquierda */}
          <radialGradient id={ids.hub} cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor={color} />
            <stop offset="100%" stopColor="#0b1220" />
          </radialGradient>

          {/* Caras de la aguja */}
          <linearGradient id={ids.needle} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="38%" stopColor={color} />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
          </linearGradient>

          <filter id={ids.groove} x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.45" />
          </filter>
          {/* El halo se hace difuminando el PROPIO trazo, no con una sombra de
              color plano: así cada tramo brilla en su color (rojo abajo a la
              izquierda, verde arriba a la derecha) en vez de teñirse entero del
              color del score. */}
          <filter id={ids.glow} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="halo" />
            <feMerge>
              <feMergeNode in="halo" />
              <feMergeNode in="halo" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={ids.shadow} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="1" dy="3" stdDeviation="2.4" floodColor="#000000" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* 1. Canal rebajado */}
        <path
          d={arcPath(0, 100)}
          fill="none"
          stroke="var(--surface-border)"
          strokeWidth="22"
          strokeLinecap="round"
          filter={`url(#${ids.groove})`}
        />
        <path
          d={arcPath(0, 100)}
          fill="none"
          stroke="#000000"
          strokeOpacity="0.35"
          strokeWidth="17"
          strokeLinecap="round"
        />

        {/* 2. Cinta de color, apagada fuera del recorrido alcanzado */}
        <path
          d={arcPath(0, 100)}
          fill="none"
          stroke={`url(#${ids.gradient})`}
          strokeWidth="13"
          strokeLinecap="round"
          opacity="0.38"
        />

        {/* 3. Recorrido alcanzado: mismo color, encendido */}
        {animated > 0.5 && (
          <>
            <path
              d={arcPath(0, animated)}
              fill="none"
              stroke={`url(#${ids.gradient})`}
              strokeWidth="13"
              strokeLinecap="round"
              filter={`url(#${ids.glow})`}
            />
            <path
              d={arcPath(0, animated)}
              fill="none"
              stroke={`url(#${ids.volume})`}
              strokeWidth="13"
              strokeLinecap="round"
            />
          </>
        )}

        {/* 4. Reflejo por el borde superior de la cinta */}
        <path
          d={arcPath(0, 100, ARC_RADIUS + 3.6)}
          fill="none"
          stroke={`url(#${ids.sheen})`}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Marcas biseladas: una línea oscura debajo de la clara */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const outer = pointAt(tick, 88);
          const inner = pointAt(tick, 77);
          return (
            <g key={tick}>
              <line
                x1={inner.x}
                y1={inner.y + 1}
                x2={outer.x}
                y2={outer.y + 1}
                stroke="rgba(0,0,0,0.55)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* 5. Aguja: se estrecha hacia la punta y proyecta sombra sobre el arco */}
        <g filter={`url(#${ids.shadow})`}>
          <polygon
            points={`${baseLeft.x},${baseLeft.y} ${needle.x},${needle.y} ${baseRight.x},${baseRight.y}`}
            fill={`url(#${ids.needle})`}
          />
          <circle cx={CENTER_X} cy={CENTER_Y} r="11" fill={`url(#${ids.hub})`} />
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r="11"
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.6"
          />
          <circle cx={CENTER_X - 3.4} cy={CENTER_Y - 3.8} r="2.6" fill="#ffffff" opacity="0.55" />
        </g>
      </svg>

      <div className="mt-1 flex flex-col items-center text-center">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-mono text-4xl font-extrabold tabular-nums sm:text-5xl"
            style={{ color, textShadow: `0 0 24px ${color}59` }}
          >
            {rounded}
          </span>
          <span className="text-xs text-muted">/ 100</span>
        </div>
        <span
          className="mt-1 rounded-full px-3 py-1 text-sm font-semibold"
          style={{
            background: `${color}1f`,
            color,
            border: `1px solid ${color}55`,
            boxShadow: `0 2px 10px ${color}33, inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}
        >
          {opportunity.etiqueta}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[9px] font-medium leading-tight text-muted sm:text-[10px]">
        {['Riesgo', 'Cautela', 'Neutral', 'Oport.', 'Alta'].map((label) => (
          <span key={label} className="min-w-0">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface RiskOpportunityScoreProps {
  opportunity: OpportunityScore;
}
