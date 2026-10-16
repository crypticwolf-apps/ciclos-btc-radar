import { CY } from './BarraLiquida';

// =============================================================================
// Caras de los extremos de la barra de miedo y codicia: 😱 y 🤑, dibujadas a
// mano como emojis en 3D (cara amarilla con volumen), para que se vean igual y
// nítidas en cualquier móvil, sin depender de la fuente de emojis del sistema.
// Van dentro de la esfera de cristal de su color (EsferaExtremo).
// =============================================================================

interface CaraProps {
  id: string;
  cx: number;
}

/** La cara amarilla con su volumen. */
function CaraAmarilla({ id, cx, nombre }: { id: string; cx: number; nombre: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}cara${nombre}`} cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#fff6c2" />
          <stop offset="45%" stopColor="#ffd23f" />
          <stop offset="100%" stopColor="#e08a00" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={CY} r="11.8" fill={`url(#${id}cara${nombre})`} />
    </>
  );
}

/** 😱: frente azul del susto, ojos como platos, boca abierta y las manos en las mejillas. */
export function CaraMiedo(p: CaraProps) {
  const { id, cx } = p;
  return (
    <g>
      <CaraAmarilla id={id} cx={cx} nombre="m" />
      {/* Frente azul del susto, como el emoji */}
      <defs>
        <linearGradient id={`${id}susto`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b8cff" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#5b8cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={CY} r="11.8" fill={`url(#${id}susto)`} />
      <ellipse cx={cx - 3.6} cy={CY - 1.6} rx="2.3" ry="2.9" fill="#fff" />
      <ellipse cx={cx + 3.6} cy={CY - 1.6} rx="2.3" ry="2.9" fill="#fff" />
      <circle cx={cx - 3.6} cy={CY - 1.2} r="0.9" fill="#3a2200" />
      <circle cx={cx + 3.6} cy={CY - 1.2} r="0.9" fill="#3a2200" />
      <ellipse cx={cx} cy={CY + 5.4} rx="2.4" ry="3.4" fill="#5a2a00" />
      {/* Manos amarillas en las mejillas */}
      <ellipse cx={cx - 10.4} cy={CY + 5} rx="2.8" ry="4.4" fill="#ffc21a" stroke="#c97a00" strokeWidth="0.6" transform={`rotate(16 ${cx - 10.4} ${CY + 5})`} />
      <ellipse cx={cx + 10.4} cy={CY + 5} rx="2.8" ry="4.4" fill="#ffc21a" stroke="#c97a00" strokeWidth="0.6" transform={`rotate(-16 ${cx + 10.4} ${CY + 5})`} />
    </g>
  );
}

/** 🤑: ojos de dólar y una sonrisa enorme con la lengua verde. */
export function CaraCodicia(p: CaraProps) {
  const { id, cx } = p;
  return (
    <g>
      <CaraAmarilla id={id} cx={cx} nombre="c" />
      <text x={cx - 4} y={CY + 0.4} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f9d4a">
        $
      </text>
      <text x={cx + 4} y={CY + 0.4} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f9d4a">
        $
      </text>
      <path d={`M ${cx - 6} ${CY + 3} Q ${cx} ${CY + 10.5} ${cx + 6} ${CY + 3} Z`} fill="#5a2a00" />
      <path d={`M ${cx - 3} ${CY + 6.2} Q ${cx} ${CY + 12} ${cx + 3} ${CY + 6.2} Z`} fill="#22c55e" />
    </g>
  );
}

