// =============================================================================
// Minigráfica de tendencia: una línea sin ejes para ver hacia dónde va un dato.
//
// SVG a mano y no recharts: van trece en una pantalla, y montar trece gráficos
// con su ResizeObserver para dibujar una línea de 60 px sería pagar mucho por
// muy poco.
// =============================================================================

interface SparklineProps {
  values: number[];
  color: string;
  className?: string;
  /** Texto accesible; sin él la gráfica es decorativa. */
  label?: string;
}

const W = 100;
const H = 28;
const PAD = 3;

export function Sparkline({ values, color, className, label }: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // Serie plana: se dibuja en el centro en vez de dividir entre cero.
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => (max === min ? H / 2 : PAD + (1 - (v - min) / span) * (H - PAD * 2));
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]!);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      // Sin deformar: el punto final tiene que seguir siendo un círculo.
      preserveAspectRatio="xMidYMid meet"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.85}
      />
      <circle cx={lastX} cy={lastY} r={2.6} fill={color} />
    </svg>
  );
}
