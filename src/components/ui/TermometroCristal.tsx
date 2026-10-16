import { useId } from 'react';
import type { OpportunityScore } from '@/types';

// =============================================================================
// Termómetro de oportunidad: un termómetro de cristal de verdad.
//
// Tubo y bulbo de vidrio sobre una placa con relieve; el líquido, de colores
// saturados, sube hasta el score con volumen cilíndrico, menisco y un reflejo
// que lo recorre despacio. Las graduaciones van grabadas en el vidrio (cada 5,
// más largas en los cortes de tramo) y, si hay histórico, la marca de hace 7
// días queda grabada en el tubo junto a la variación.
//
// Los tramos son los del propio score (35 / 50 / 65 / 80), los mismos que
// deciden su etiqueta: antes, las cinco palabras de debajo repartían el arco en
// partes iguales y no coincidían con lo que marcaba la aguja. Los nombres van en
// una leyenda aparte, no bajo la escala, para que nunca se pisen.
//
// El instrumento tiene su propia esfera oscura en los dos temas: los colores
// de neón no se leerían sobre fondo claro. Las animaciones (subida del líquido
// y reflejo) están en index.css y se apagan con «reducir movimiento».
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

/** Posición horizontal de un valor en el tubo. */
export const posicion = (s: number) => X0 + (limitarScore(s) / 100) * (X1 - X0);

/** Número con relieve: capas de sombra que lo extruyen y un halo de neón. */
function NumeroNeon({ score }: { score: number }) {
  const t = tramoDe(score);
  const capas = Array.from({ length: 4 }, () => `drop-shadow(0 1.5px 0 ${t.oscuro})`).join(' ');
  return (
    <span
      className="font-mono text-[3.25rem] font-extrabold leading-none tabular-nums sm:text-6xl"
      style={{
        color: t.claro,
        backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${t.claro} 30%, ${t.color} 70%)`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        filter: `${capas} drop-shadow(0 4px 6px rgba(0,0,0,0.6)) drop-shadow(0 0 14px ${t.color}99)`,
      }}
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
      className="termo-esfera w-full max-w-[400px] shrink-0 rounded-3xl p-4 sm:p-5"
    >
      <div className="mb-1 flex items-end justify-between gap-3 px-1">
        <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <NumeroNeon score={score} />
          <span className="text-xs font-semibold text-slate-400">/ 100</span>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1.5">
          <span
            className="whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold sm:text-sm"
            style={{
              color: t.claro,
              background: `linear-gradient(180deg, ${t.color}40, ${t.oscuro}66)`,
              border: `1px solid ${t.color}99`,
              boxShadow: `0 0 16px ${t.color}55, inset 0 1px 0 rgba(255,255,255,0.35), 0 3px 0 ${t.oscuro}`,
              textShadow: '0 1px 0 rgba(0,0,0,0.5)',
            }}
          >
            {opportunity.etiqueta}
          </span>
          {delta != null && (
            <span className={`text-xs font-bold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ −${Math.abs(delta)}` : '= sin cambios'} en 7 días
            </span>
          )}
        </div>
      </div>

      <svg viewBox="0 0 340 128" className="block h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}placa`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#24324b" />
            <stop offset="100%" stopColor="#0a101b" />
          </linearGradient>
          <linearGradient id={`${id}liquido`} x1={X0} y1="0" x2={X1} y2="0" gradientUnits="userSpaceOnUse">
            {TRAMOS.map((tr) => (
              <stop key={tr.nombre} offset={`${(tr.desde + tr.hasta) / 2}%`} stopColor={tr.color} />
            ))}
          </linearGradient>
          <linearGradient id={`${id}cilindro`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="28%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`${id}vidrio`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="85%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={`${id}reflejo`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}bulbo`} cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="16%" stopColor={TRAMOS[0]!.claro} />
            <stop offset="55%" stopColor={TRAMOS[0]!.color} />
            <stop offset="100%" stopColor={TRAMOS[0]!.oscuro} />
          </radialGradient>
          <radialGradient id={`${id}tornillo`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#8f9bb0" />
            <stop offset="100%" stopColor="#2b3445" />
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
          <clipPath id={`${id}nivel`}>
            <rect x={X0 - 22} y={CY - 10} width={x(score) - X0 + 22} height="20" />
          </clipPath>
        </defs>

        {/* Placa de montaje con relieve */}
        <rect x="6" y="20" width="328" height="98" rx="18" fill="#000" opacity="0.55" filter={`url(#${id}sombra)`} />
        <rect x="6" y="14" width="328" height="98" rx="18" fill={`url(#${id}placa)`} />
        <rect x="6.5" y="14.5" width="327" height="97" rx="17.5" fill="none" stroke="#fff" strokeOpacity="0.1" />
        <path d="M 24 14.5 H 316" stroke="#fff" strokeOpacity="0.28" />
        {[26, 100].map((sy) => (
          <g key={sy}>
            <circle cx="322" cy={sy} r="4" fill={`url(#${id}tornillo)`} />
            <line x1="319.6" y1={sy - 1.4} x2="324.4" y2={sy + 1.4} stroke="#1a2130" strokeWidth="1.1" />
          </g>
        ))}

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
              stroke="#fff"
              strokeOpacity={corte ? 0.8 : 0.3}
              strokeWidth={corte ? 1.4 : 1}
            />
          );
        })}
        {CORTES.map((s) => (
          <text key={s} x={x(s)} y={CY - 31} textAnchor="middle" fontSize="9" fontWeight="700" fill="#aab6c8" className="font-mono">
            {s}
          </text>
        ))}

        {/* Vidrio */}
        <rect x={X0 - 26} y={CY - 16} width={X1 - X0 + 36} height="32" rx="16" fill="rgba(150,180,255,0.07)" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" />
        <circle cx="40" cy={CY} r="31" fill="rgba(150,180,255,0.07)" stroke="rgba(255,255,255,0.42)" strokeWidth="1.2" />

        {/* Líquido: brillo de neón, color por tramos y volumen cilíndrico */}
        <g clipPath={`url(#${id}tubo)`} filter={`url(#${id}brillo)`}>
          <rect className="termo-liquido" x={X0 - 22} y={CY - 10} width={x(score) - X0 + 22} height="20" fill={`url(#${id}liquido)`} />
        </g>
        <g clipPath={`url(#${id}tubo)`}>
          <rect className="termo-liquido" x={X0 - 22} y={CY - 10} width={x(score) - X0 + 22} height="20" fill={`url(#${id}cilindro)`} />
          {/* Reflejo que recorre el líquido */}
          <g clipPath={`url(#${id}nivel)`}>
            <rect className="termo-reflejo" x={X0 - 50} y={CY - 10} width="26" height="20" fill={`url(#${id}reflejo)`} />
          </g>
        </g>
        <ellipse className="termo-menisco" cx={x(score)} cy={CY} rx="3.6" ry="10" fill={t.claro} filter={`url(#${id}brillo)`} />
        <circle cx="40" cy={CY} r="24" fill={`url(#${id}bulbo)`} filter={`url(#${id}brillo)`} />

        {/* Hace 7 días: marca grabada en el vidrio */}
        {hace7 != null && (
          <g>
            <line x1={x(hace7)} x2={x(hace7)} y1={CY - 15} y2={CY + 15} stroke="#fff" strokeOpacity="0.75" strokeWidth="1.4" strokeDasharray="2.5 2" />
            <text x={x(hace7)} y={CY + 26} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#cbd5e1">
              7 d
            </text>
          </g>
        )}

        {/* Reflejos del vidrio */}
        <rect x={X0 - 26} y={CY - 16} width={X1 - X0 + 36} height="32" rx="16" fill={`url(#${id}vidrio)`} />
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
        <polygon points={`${x(score) - 5},${CY + 47} ${x(score) + 5},${CY + 47} ${x(score)},${CY + 40}`} fill={t.claro} />
      </svg>

      {/* Leyenda: una celda por tramo, con su nombre y su rango; la actual, encendida */}
      <div className="mt-2 grid grid-cols-5 gap-1">
        {TRAMOS.map((tr) => {
          const activo = tr === t;
          return (
            <div
              key={tr.nombre}
              className="flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-center"
              style={
                activo
                  ? { background: `${tr.color}22`, border: `1px solid ${tr.color}aa`, boxShadow: `0 0 12px ${tr.color}44` }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: tr.color, boxShadow: activo ? `0 0 8px ${tr.color}` : 'none', opacity: activo ? 1 : 0.55 }}
              />
              <span className="text-[10px] font-bold leading-tight" style={{ color: activo ? tr.claro : '#94a3b8' }}>
                {tr.nombre}
              </span>
              <span className="font-mono text-[9px] leading-none" style={{ color: activo ? tr.claro : '#64748b' }}>
                {tr.desde}–{tr.hasta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
