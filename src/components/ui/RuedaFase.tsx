import { memo, useId } from 'react';
import type { CyclePhase, CyclePhaseId } from '@/types';
import { PHASES } from '@/data/phases';
import { varsZona } from './BarraLiquida';

// =============================================================================
// Fase del ciclo de Bitcoin en una rueda de cristal: las fases son cíclicas, así
// que van en círculo, en el orden en que se suceden y en el sentido de las
// agujas del reloj (acumulación arriba, expansión temprana, expansión avanzada,
// euforia, corrección, capitulación, recuperación… y vuelta a la acumulación).
//
// Es un anillo de cristal entero, sin cortes, lleno de líquido: un degradado
// continuo que pasa de una fase a la siguiente con sus colores, con volumen y
// burbujas que fluyen en el sentido del ciclo. Al abrir se llena poco a poco,
// desde arriba y en el sentido del reloj (como fluye el ciclo), y al acabar
// aparece la esfera de la fase actual. La fase de AHORA la marca una
// esfera en su sitio, con un halo que late de su color; su nombre va en el
// centro y, alrededor, los de todas. Sin emojis: solo el líquido y el color.
//
// No es una cifra: la fase la deciden reglas (lib/cycle/phaseRule).
// =============================================================================

export const ORDEN_FASES: readonly CyclePhaseId[] = [
  'acumulacion',
  'expansion-temprana',
  'expansion-avanzada',
  'euforia',
  'correccion',
  'capitulacion',
  'recuperacion',
];

/** Rótulo corto alrededor de la rueda (el nombre entero va en el centro). */
const ROTULO: Partial<Record<CyclePhaseId, string>> = {
  'expansion-temprana': 'Exp. temprana',
  'expansion-avanzada': 'Exp. avanzada',
  capitulacion: 'Capitulación',
};
/** Nombre en el centro: el de «capitulación» lleva coletilla y no cabe. */
const CENTRO: Partial<Record<CyclePhaseId, string>> = { capitulacion: 'Capitulación' };

/** Tonos claro y oscuro de cada fase, para el relieve y los dos temas. */
const TONOS: Record<CyclePhaseId, [claro: string, oscuro: string]> = {
  acumulacion: ['#a7f3c4', '#0b6b31'],
  'expansion-temprana': ['#b3d1ff', '#163f9e'],
  'expansion-avanzada': ['#d4c4ff', '#4a23a8'],
  euforia: ['#ffd98a', '#8a5500'],
  correccion: ['#ffb0b0', '#8f1414'],
  capitulacion: ['#ff9a9a', '#6b0a0a'],
  recuperacion: ['#9cf2d2', '#06684a'],
};

// Geometría (viewBox 340 × 230): rueda centrada, con sitio a los lados para los
// nombres y dentro para el de la fase actual («Recuperación» no debe tocar el
// borde interior).
const CX = 170;
const CY = 115;
const R = 74;
const PASO = 360 / ORDEN_FASES.length;

export const FASES_RUEDA = ORDEN_FASES.map((id, i) => ({
  id,
  nombre: CENTRO[id] ?? PHASES[id].nombre,
  rotulo: ROTULO[id] ?? PHASES[id].nombre,
  /** Ángulo del centro del tramo, en grados desde las 12 y en el sentido del reloj. */
  angulo: i * PASO,
  color: PHASES[id].color,
  claro: TONOS[id][0],
  oscuro: TONOS[id][1],
}));

/** Ángulo (grados desde las 12, sentido del reloj) del centro de una fase; -1 si no se reconoce. */
export function anguloFase(id: CyclePhaseId): number {
  const i = ORDEN_FASES.indexOf(id);
  return i < 0 ? -1 : i * PASO;
}

/** Punto de la rueda a un radio y un ángulo (desde las 12, sentido del reloj). */
function punto(r: number, grados: number): [number, number] {
  const a = ((grados - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

/** Arco en el sentido del reloj entre dos ángulos. */
function arco(r: number, desde: number, hasta: number): string {
  const [x0, y0] = punto(r, desde);
  const [x1, y1] = punto(r, hasta);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Mezcla de dos colores #rrggbb (t = 0 el primero, 1 el segundo). */
function mezcla(a: string, b: string, t: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${ca.map((v, i) => Math.round(v + (cb[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * El degradado del anillo. SVG no tiene degradados cónicos, así que se dibuja
 * en tramos cortos, cada uno del color que toca entre el centro de una fase y el
 * de la siguiente (y de la última vuelve a la primera). Se solapan un poco para
 * que no se vean juntas.
 */
const PASOS_POR_FASE = 12;
const DEGRADADO = FASES_RUEDA.flatMap((f, i) => {
  const siguiente = FASES_RUEDA[(i + 1) % FASES_RUEDA.length]!;
  return Array.from({ length: PASOS_POR_FASE }, (_, k) => {
    const desde = f.angulo + (k / PASOS_POR_FASE) * PASO;
    const hasta = f.angulo + ((k + 1) / PASOS_POR_FASE) * PASO;
    return { d: arco(R, desde - 0.4, hasta + 0.4), color: mezcla(f.color, siguiente.color, (k + 0.5) / PASOS_POR_FASE) };
  });
});

export const RuedaFase = memo(function RuedaFase({
  fase,
  compact,
}: {
  fase: CyclePhase;
  /** Versión reducida para la pantalla de inicio. */
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const indice = ORDEN_FASES.indexOf(fase.id);
  const actual = indice >= 0 ? FASES_RUEDA[indice]! : null;
  const [ex, ey] = actual ? punto(R, actual.angulo) : [CX, CY];

  return (
    <div
      className={`relative mx-auto w-full ${compact ? 'max-w-[340px]' : 'max-w-[400px]'}`}
      role="img"
      aria-label={`Fase estimada del ciclo: ${fase.nombre}${indice >= 0 ? `, ${indice + 1}.ª de ${ORDEN_FASES.length}` : ''}.`}
    >
      <svg viewBox="0 0 340 230" className="block h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          {actual && (
            <radialGradient id={`${id}esfera`} cx="32%" cy="26%" r="75%">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="28%" stopColor={actual.claro} />
              <stop offset="60%" stopColor={actual.color} />
              <stop offset="100%" stopColor={actual.oscuro} />
            </radialGradient>
          )}
          <radialGradient id={`${id}vidrio`} cx={CX} cy={CY} r={R + 13} gradientUnits="userSpaceOnUse">
            <stop offset={`${((R - 13) / (R + 13)) * 100}%`} stopColor="#fff" stopOpacity="0.16" />
            <stop offset={`${(R / (R + 13)) * 100}%`} stopColor="#fff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.2" />
          </radialGradient>
          {/* Filtros en coordenadas del dibujo, con margen para el brillo. */}
          <filter id={`${id}brillo`} filterUnits="userSpaceOnUse" x="0" y="-20" width="340" height="260">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${id}halo`} filterUnits="userSpaceOnUse" x="0" y="-20" width="340" height="260">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={`${id}sombra`} filterUnits="userSpaceOnUse" x="0" y="-20" width="340" height="260">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          {/* El llenado: una máscara que descubre el anillo desde las 12 y en el
              sentido del reloj. Más ancha que el tubo para no recortar el brillo.
              Sin animación («reducir movimiento») queda entera. */}
          <mask id={`${id}relleno`} maskUnits="userSpaceOnUse" x="0" y="0" width="340" height="230">
            <circle
              className="fase-relleno"
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="#fff"
              strokeWidth="46"
              pathLength={100}
              strokeDasharray="100 100"
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          </mask>
        </defs>

        {/* Sombra sobre la tarjeta */}
        <ellipse cx={CX} cy={CY + R + 22} rx="78" ry="5" fill="var(--termo-sombra)" filter={`url(#${id}sombra)`} />

        {/* Anillo de vidrio */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--termo-vidrio)" strokeWidth="26" />
        <circle cx={CX} cy={CY} r={R + 13} fill="none" stroke="var(--termo-vidrio-borde)" strokeWidth="1.2" />
        <circle cx={CX} cy={CY} r={R - 13} fill="none" stroke="var(--termo-vidrio-borde)" strokeWidth="1.2" />

        {/* Halo que late detrás de la fase actual */}
        {actual && (
          <g className="fase-aparece">
            <path
              className="alt-halo"
              d={arco(R, actual.angulo - PASO / 2, actual.angulo + PASO / 2)}
              fill="none"
              stroke={actual.color}
              strokeWidth="26"
              strokeLinecap="round"
              opacity="0.55"
              filter={`url(#${id}halo)`}
            />
          </g>
        )}

        {/* El líquido se llena desde arriba en el sentido del reloj */}
        <g mask={`url(#${id}relleno)`}>
          {/* Líquido: el anillo entero, en degradado de fase en fase, con brillo */}
          <g filter={`url(#${id}brillo)`}>
            {DEGRADADO.map((t, i) => (
              <path key={i} d={t.d} fill="none" stroke={t.color} strokeWidth="15" />
            ))}
          </g>
          {/* Volumen: luz en el borde de fuera, sombra en el de dentro */}
          <circle cx={CX} cy={CY} r={R + 4.6} fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="2.2" />
          <circle cx={CX} cy={CY} r={R - 4.8} fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="3" />
          {/* Corriente y burbujas en el sentido del ciclo (el de las agujas del
              reloj). `pathLength`: el dibujo cabe un número entero de veces en la
              vuelta, así que no se nota dónde empieza. */}
          <circle className="fase-ola" cx={CX} cy={CY} r={R + 1.2} pathLength={392} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="5 9" strokeLinecap="round" />
          <circle className="fase-burbujas" cx={CX} cy={CY} r={R - 1.5} pathLength={396} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.2" strokeDasharray="0.1 6.5" strokeLinecap="round" />
        </g>

        {/* Reflejos del vidrio */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={`url(#${id}vidrio)`} strokeWidth="26" />
        <path d={arco(R + 9, 290, 340)} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
        <path d={arco(R - 9, 300, 325)} fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.6" strokeLinecap="round" />

        {/* Esfera en la fase actual: aparece cuando el líquido ha llegado */}
        {actual && (
          <g className="fase-aparece">
            <circle cx={ex + 1} cy={ey + 3} r="9.5" fill="#000" opacity="0.35" filter={`url(#${id}sombra)`} />
            <circle cx={ex} cy={ey} r="9.5" fill={`url(#${id}esfera)`} stroke="#fff" strokeOpacity="0.9" strokeWidth="2" />
            <ellipse cx={ex - 3} cy={ey - 4} rx="3" ry="1.8" fill="#fff" opacity="0.7" />
          </g>
        )}

        {/* Nombres alrededor; el de la actual, encendido */}
        {FASES_RUEDA.map((f) => {
          const [x, y] = punto(R + 22, f.angulo);
          const dx = x - CX;
          const activa = f === actual;
          return (
            <text
              key={f.id}
              x={x}
              y={y}
              textAnchor={dx > 20 ? 'start' : dx < -20 ? 'end' : 'middle'}
              dominantBaseline="middle"
              fontSize="10"
              fontWeight={activa ? 800 : 600}
              className={activa ? 'termo-relleno' : undefined}
              fill={activa ? undefined : 'var(--text-muted)'}
              style={activa ? varsZona({ ...f, desde: 0, hasta: 0 }) : undefined}
            >
              {f.rotulo}
            </text>
          );
        })}
      </svg>

      {/* En el centro, el nombre de la fase actual */}
      {actual && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[32%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
          <span
            className={`termo-texto font-extrabold leading-tight ${compact ? 'text-[13px] sm:text-sm' : 'text-sm sm:text-base'}`}
            style={varsZona({ ...actual, desde: 0, hasta: 0 })}
          >
            {actual.nombre}
          </span>
          {/* En Inicio el rótulo va encima de la rueda; aquí sobraría. */}
          {!compact && <span className="mt-0.5 text-[10px] leading-tight text-muted">Fase del ciclo</span>}
        </div>
      )}
    </div>
  );
});
