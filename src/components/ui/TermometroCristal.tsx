import { useId, type CSSProperties } from 'react';
import type { OpportunityScore } from '@/types';

// =============================================================================
// Termómetro de oportunidad: un termómetro de cristal de verdad.
//
// Tubo y bulbo de vidrio con sombra sobre la tarjeta; el líquido sube hasta el
// score con un degradado continuo (del rojo intenso del riesgo al turquesa de
// «muy favorable»), volumen cilíndrico, una onda que fluye por la superficie,
// burbujas y un menisco curvo; el bulbo, lleno, suelta burbujas que suben. Las graduaciones van grabadas en el vidrio (cada 5,
// más largas en los cortes de tramo) y, si hay histórico, la marca de hace 7
// días queda grabada en el tubo junto a la variación.
//
// Los tramos son los del propio score (35 / 50 / 65 / 80), los mismos que
// deciden su etiqueta: antes, las cinco palabras de debajo repartían el arco en
// partes iguales y no coincidían con lo que marcaba la aguja. Los nombres van en
// una leyenda aparte, no bajo la escala, para que nunca se pisen.
//
// Va integrado en la tarjeta, sin fondo propio: el vidrio, la escala, la
// leyenda y el número toman los colores del tema (variables --termo-* y clases
// termo-* de index.css), así que se lee igual en claro y en oscuro. Las
// animaciones (subida del líquido, onda y burbujas) también están allí y se apagan con
// «reducir movimiento».
// =============================================================================

export interface Tramo {
  desde: number;
  hasta: number;
  /** Nombre corto para la leyenda. */
  nombre: string;
  color: string;
  claro: string;
  oscuro: string;
}

/** Cortes de `scoreLabel` (lib/score/opportunityScore), con su color. */
export const TRAMOS: readonly Tramo[] = [
  { desde: 0, hasta: 35, nombre: 'Riesgo', color: '#ff2d55', claro: '#ff9bb0', oscuro: '#8a0022' },
  { desde: 35, hasta: 50, nombre: 'Exigente', color: '#ff9500', claro: '#ffcf80', oscuro: '#8f4a00' },
  { desde: 50, hasta: 65, nombre: 'Equilibrado', color: '#c6f000', claro: '#ecff8a', oscuro: '#5f7500' },
  { desde: 65, hasta: 80, nombre: 'Favorable', color: '#22e06b', claro: '#9cf7bf', oscuro: '#08702f' },
  { desde: 80, hasta: 100, nombre: 'Muy favorable', color: '#00e5d4', claro: '#9cfff5', oscuro: '#006f68' },
];

export const limitarScore = (s: number) => Math.min(100, Math.max(0, Number.isFinite(s) ? s : 0));

export function tramoDe(score: number): Tramo {
  const s = limitarScore(score);
  return TRAMOS.find((t) => s < t.hasta) ?? TRAMOS[TRAMOS.length - 1]!;
}

// Geometría del dibujo (viewBox 340 × 128).
const X0 = 70;
const X1 = 314;
const CY = 70;
const CORTES = [0, 35, 50, 65, 80, 100];

/**
 * Degradado del líquido a lo largo de la escala: transiciones suaves entre los
 * colores de los tramos, con tonos intermedios en los cortes (un color por
 * tramo dejaba bandas planas y saltos bruscos).
 */
const DEGRADADO: readonly [number, string][] = [
  [0, '#c4001f'],
  [18, '#ff2d3f'],
  [35, '#ff6a1a'],
  [44, '#ff9a00'],
  [50, '#ffc400'],
  [57, '#d8f000'],
  [65, '#8ee63a'],
  [72, '#2fe06b'],
  [80, '#14d99a'],
  [90, '#00e0c4'],
  [100, '#19e8ff'],
];

/**
 * Contorno del vidrio en una sola pieza: el bulbo (r 31) y el tubo (32 de alto,
 * extremo redondeado). Dibujados por separado, el extremo izquierdo del tubo se
 * veía como un disco fantasma dentro del bulbo.
 */
const CUELLO = 40 + Math.sqrt(31 ** 2 - 16 ** 2);
const VIDRIO = `M ${CUELLO} ${CY - 16} H 308 A 16 16 0 0 1 308 ${CY + 16} H ${CUELLO} A 31 31 0 1 1 ${CUELLO} ${CY - 16} Z`;

/** Posición horizontal de un valor en el tubo. */
export const posicion = (s: number) => X0 + (limitarScore(s) / 100) * (X1 - X0);

/** Colores de un tramo como variables CSS: index.css usa el claro en tema oscuro y el oscuro en claro. */
const varsDe = (t: Tramo) => ({ '--tc-color': t.color, '--tc-claro': t.claro, '--tc-oscuro': t.oscuro }) as CSSProperties;

/** Número con relieve (capas de sombra que lo extruyen) y halo del color del tramo. */
function NumeroNeon({ score }: { score: number }) {
  return (
    <span
      className="termo-numero font-mono text-[3.25rem] font-extrabold leading-none tabular-nums sm:text-6xl"
      style={varsDe(tramoDe(score))}
    >
      {score}
    </span>
  );
}

export function TermometroCristal({ opportunity, hace7 }: { opportunity: OpportunityScore; hace7: number | null }) {
  const id = useId().replace(/:/g, '');
  const score = Math.round(limitarScore(opportunity.score));
  const t = tramoDe(score);
  const x = posicion;
  const delta = hace7 == null ? null : score - Math.round(hace7);

  return (
    <div
      role="meter"
      aria-label="Termómetro de oportunidad"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-valuetext={`${score} de 100, ${opportunity.etiqueta}`}
      className="w-full max-w-[400px] shrink-0"
    >
      <div className="mb-1 flex items-end justify-between gap-3 px-1">
        <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <NumeroNeon score={score} />
          <span className="text-xs font-semibold text-muted">/ 100</span>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1.5">
          <span className="termo-etiqueta whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold sm:text-sm" style={varsDe(t)}>
            {opportunity.etiqueta}
          </span>
          {delta != null && (
            <span className={`text-xs font-bold ${delta > 0 ? 'text-bull' : delta < 0 ? 'text-bear' : 'text-muted'}`}>
              {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ −${Math.abs(delta)}` : '= sin cambios'} en 7 días
            </span>
          )}
        </div>
      </div>

      <svg viewBox="0 28 340 94" className="block h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}liquido`} x1={X0} y1="0" x2={X1} y2="0" gradientUnits="userSpaceOnUse">
            {DEGRADADO.map(([o, c]) => (
              <stop key={o} offset={`${o}%`} stopColor={c} />
            ))}
          </linearGradient>
          {/* Menisco: la punta curva del líquido, más clara por la luz */}
          <linearGradient id={`${id}menisco`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="40%" stopColor={t.claro} />
            <stop offset="100%" stopColor={t.color} />
          </linearGradient>
          {/* Onda que fluye por la superficie, con burbujas (la de la barra del
              Altseason) y una segunda, más ancha y lenta, que le da fondo */}
          <pattern id={`${id}ola`} x="0" y={CY - 10} width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 5 Q10 2 20 5 T40 5 L40 7.2 Q30 10.2 20 7.2 Q10 4.2 0 7.2 Z" fill="#fff" opacity="0.38" />
            <circle cx="9" cy="13" r="1.3" fill="#fff" opacity="0.5" />
            <circle cx="27" cy="15.5" r="0.9" fill="#fff" opacity="0.4" />
            <circle cx="33" cy="11" r="0.7" fill="#fff" opacity="0.35" />
          </pattern>
          <pattern id={`${id}ola2`} x="0" y={CY - 10} width="64" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 11 Q16 8 32 11 T64 11 L64 12.6 Q48 15.6 32 12.6 Q16 9.6 0 12.6 Z" fill="#fff" opacity="0.16" />
            <circle cx="46" cy="16" r="1.1" fill="#fff" opacity="0.35" />
            <circle cx="18" cy="6.5" r="0.8" fill="#fff" opacity="0.3" />
          </pattern>
          <linearGradient id={`${id}cilindro`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="28%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`${id}vidrio`} x1="0" y1={CY - 16} x2="0" y2={CY + 16} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="85%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
          </linearGradient>
          <radialGradient id={`${id}bulbo`} cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="14%" stopColor="#ff8a96" />
            <stop offset="45%" stopColor="#ff2d3f" />
            <stop offset="78%" stopColor="#c4001f" />
            <stop offset="100%" stopColor="#5e0010" />
          </radialGradient>
          {/* Filtros en coordenadas del dibujo: relativos a cada figura, el
              brillo de una franja estrecha salía recortado en rectángulo. */}
          <filter id={`${id}brillo`} filterUnits="userSpaceOnUse" x="-20" y="-20" width="380" height="170">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${id}sombra`} filterUnits="userSpaceOnUse" x="-20" y="-20" width="380" height="170">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <clipPath id={`${id}tubo`}>
            <rect x={X0 - 22} y={CY - 10} width={X1 - X0 + 24} height="20" rx="10" />
          </clipPath>
          {/* Hasta el score, con la punta redondeada del menisco */}
          <clipPath id={`${id}nivel`}>
            <path d={`M ${X0 - 22} ${CY - 10} H ${x(score) - 4} A 7 10 0 0 1 ${x(score) - 4} ${CY + 10} H ${X0 - 22} Z`} />
          </clipPath>
        </defs>

        {/* Sombra del termómetro sobre la tarjeta */}
        <ellipse cx="182" cy={CY + 24} rx="150" ry="5" fill="var(--termo-sombra)" filter={`url(#${id}sombra)`} />

        {/* Graduaciones grabadas: cada 5, más largas en los cortes de tramo */}
        {Array.from({ length: 21 }, (_, i) => i * 5).map((s) => {
          const corte = CORTES.includes(s);
          return (
            <line
              key={s}
              x1={x(s)}
              x2={x(s)}
              y1={CY - (corte ? 27 : 23)}
              y2={CY - 18}
              stroke="var(--termo-grabado)"
              strokeOpacity={corte ? 1 : 0.45}
              strokeWidth={corte ? 1.4 : 1}
            />
          );
        })}
        {CORTES.map((s) => (
          <text key={s} x={x(s)} y={CY - 31} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text-muted)" className="font-mono">
            {s}
          </text>
        ))}

        {/* Vidrio */}
        <path d={VIDRIO} fill="var(--termo-vidrio)" stroke="var(--termo-vidrio-borde)" strokeWidth="1.2" />

        {/* Líquido: brillo, degradado continuo y volumen cilíndrico, con la punta
            redondeada del menisco */}
        <g clipPath={`url(#${id}tubo)`} filter={`url(#${id}brillo)`}>
          <g clipPath={`url(#${id}nivel)`}>
            <rect className="termo-liquido" x={X0 - 22} y={CY - 10} width={x(score) - X0 + 26} height="20" fill={`url(#${id}liquido)`} />
          </g>
        </g>
        <g clipPath={`url(#${id}tubo)`}>
          <g clipPath={`url(#${id}nivel)`}>
            <rect className="termo-liquido" x={X0 - 22} y={CY - 10} width={x(score) - X0 + 26} height="20" fill={`url(#${id}cilindro)`} />
            {/* Ondas y burbujas que fluyen por el líquido; aparecen con el
                menisco, cuando el líquido ya ha subido */}
            <g className="termo-menisco">
              <rect className="termo-ola-lenta" x={X0 - 90} y={CY - 10} width={X1 - X0 + 130} height="20" fill={`url(#${id}ola2)`} />
              <rect className="alt-ola" x={X0 - 60} y={CY - 10} width={X1 - X0 + 100} height="20" fill={`url(#${id}ola)`} />
            </g>
          </g>
        </g>
        {/* Menisco: la luz que refracta la punta curva del líquido */}
        <g className="termo-menisco">
          <path
            d={`M ${x(score) - 4} ${CY - 10} A 7 10 0 0 1 ${x(score) - 4} ${CY + 10} A 3 10 0 0 0 ${x(score) - 4} ${CY - 10} Z`}
            fill={`url(#${id}menisco)`}
            filter={`url(#${id}brillo)`}
          />
          <path d={`M ${x(score) - 4} ${CY - 8} A 5.5 8 0 0 1 ${x(score) - 4} ${CY + 8}`} fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.9" />
        </g>
        {/* Bulbo lleno, con burbujas que suben */}
        <circle cx="40" cy={CY} r="24" fill={`url(#${id}bulbo)`} filter={`url(#${id}brillo)`} />
        <g fill="#fff">
          <circle className="termo-burbuja" cx="34" cy={CY + 10} r="2" opacity="0.5" />
          <circle className="termo-burbuja termo-burbuja-2" cx="45" cy={CY + 12} r="1.4" opacity="0.45" />
          <circle className="termo-burbuja termo-burbuja-3" cx="40" cy={CY + 8} r="1.1" opacity="0.4" />
        </g>

        {/* Hace 7 días: marca grabada en el vidrio */}
        {hace7 != null && (
          <g>
            <line x1={x(hace7)} x2={x(hace7)} y1={CY - 15} y2={CY + 15} stroke="var(--termo-grabado)" strokeWidth="1.4" strokeDasharray="2.5 2" />
            <text x={x(hace7)} y={CY + 26} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--text-secondary)">
              7 d
            </text>
          </g>
        )}

        {/* Reflejos del vidrio */}
        <path d={VIDRIO} fill={`url(#${id}vidrio)`} />
        <rect x={X0 - 8} y={CY - 12} width={X1 - X0 + 6} height="3" rx="1.5" fill="#fff" opacity="0.6" />
        <rect x={X0 + 20} y={CY + 9} width={X1 - X0 - 40} height="1.6" rx="0.8" fill="#fff" opacity="0.18" />
        <ellipse cx="29" cy={CY - 13} rx="10" ry="5.5" fill="#fff" opacity="0.65" transform={`rotate(-30 29 ${CY - 13})`} />

        {/* Franja de tramos bajo el tubo y flecha del valor */}
        {TRAMOS.map((tr) => (
          <rect
            key={tr.nombre}
            x={x(tr.desde) + 1}
            y={CY + 33}
            width={x(tr.hasta) - x(tr.desde) - 2}
            height="5"
            rx="2.5"
            fill={tr.color}
            opacity={tr === t ? 1 : 0.32}
          />
        ))}
        <polygon points={`${x(score) - 5},${CY + 47} ${x(score) + 5},${CY + 47} ${x(score)},${CY + 40}`} fill={t.color} />
      </svg>

      {/* Leyenda: una celda por tramo, con su nombre y su rango; la actual, encendida */}
      <div className="mt-2 grid grid-cols-5 gap-1">
        {TRAMOS.map((tr) => {
          const activo = tr === t;
          return (
            <div
              key={tr.nombre}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-center ${activo ? 'termo-celda-activa termo-texto' : 'termo-celda text-muted'}`}
              style={varsDe(tr)}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: tr.color, boxShadow: activo ? `0 0 8px ${tr.color}` : 'none', opacity: activo ? 1 : 0.55 }}
              />
              <span className="text-[10px] font-bold leading-tight">{tr.nombre}</span>
              <span className="font-mono text-[9px] leading-none opacity-80">
                {tr.desde}–{tr.hasta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
