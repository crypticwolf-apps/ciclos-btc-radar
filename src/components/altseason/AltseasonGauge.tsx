import { CLASSIFICATIONS } from '@/lib/altseason/config';
import { altseasonColor } from '@/lib/altseason/score';

// =============================================================================
// Indicador visual del Altseason Score.
//
// Es una BARRA de zonas, no un semicírculo, a propósito: el score representa una
// posición dentro de un recorrido (de dominio de BTC a euforia de altcoins) y
// una barra lo comunica mejor que una aguja, además de escalar sin problemas a
// 320 px sin solapar etiquetas.
//
// Todo el dibujo va en porcentajes dentro de un SVG con `viewBox` y
// `preserveAspectRatio="none"` solo en la banda de color; las etiquetas van en
// HTML normal (grid), que se reajusta solo y nunca recorta texto.
// =============================================================================

const ZONES = [
  { label: 'Bitcoin', color: '#f59e0b' },
  { label: 'Rotación', color: '#eab308' },
  { label: 'Mixto', color: '#94a3b8' },
  { label: 'Altseason', color: '#22c55e' },
  { label: 'Euforia', color: '#8b5cf6' },
] as const;

interface AltseasonGaugeProps {
  /** 0-100, o `null` si no se pudo calcular. */
  score: number | null;
  classification: string;
  phaseLabel: string;
}

export function AltseasonGauge({ score, classification, phaseLabel }: AltseasonGaugeProps) {
  const valid = score != null && Number.isFinite(score);
  const clamped = valid ? Math.max(0, Math.min(100, score)) : 0;
  const color = valid ? altseasonColor(clamped) : '#94a3b8';

  const aria = valid
    ? `Altseason Score ${clamped} de 100. ${classification}. Fase del ciclo de altcoins: ${phaseLabel}.`
    : 'Altseason Score no disponible por falta de datos.';

  return (
    <div className="w-full" role="img" aria-label={aria}>
      {/* Valor grande, legible desde 320 px */}
      <div className="flex items-end justify-center gap-2">
        <span
          className="font-mono text-5xl font-extrabold leading-none tabular-nums sm:text-6xl"
          style={{ color }}
        >
          {valid ? clamped : '—'}
        </span>
        <span className="mb-1 text-sm text-muted">/ 100</span>
      </div>
      <p
        className="mt-1.5 text-center text-sm font-bold"
        style={{ color: valid ? color : undefined }}
      >
        {classification}
      </p>

      {/* Banda de zonas: cada una ocupa su rango real del 0-100 */}
      <div className="mt-4">
        <svg
          viewBox="0 0 100 8"
          preserveAspectRatio="none"
          className="h-3 w-full overflow-visible"
          aria-hidden="true"
        >
          {ZONES.map((z, i) => {
            const from = i === 0 ? 0 : CLASSIFICATIONS[i - 1]!.max;
            const to = CLASSIFICATIONS[i]!.max;
            return (
              <rect
                key={z.label}
                x={from}
                y={0}
                width={to - from}
                height={8}
                fill={z.color}
                opacity={valid && clamped > from && clamped <= to ? 1 : 0.35}
                rx={0.6}
              />
            );
          })}

          {/* Marcador en la posición EXACTA del score */}
          {valid && (
            <g>
              <line
                x1={clamped}
                x2={clamped}
                y1={-2.5}
                y2={10.5}
                stroke="var(--text-primary, #fff)"
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={clamped}
                cy={4}
                r={2.6}
                fill={color}
                stroke="var(--text-primary, #fff)"
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
        </svg>

        {/* Etiquetas en grid: se reparten el ancho y nunca se solapan */}
        <div className="mt-2 grid grid-cols-5 gap-0.5 text-center">
          {ZONES.map((z, i) => {
            const from = i === 0 ? 0 : CLASSIFICATIONS[i - 1]!.max;
            const to = CLASSIFICATIONS[i]!.max;
            const active = valid && clamped > from && clamped <= to;
            return (
              <div key={z.label} className="min-w-0">
                <span
                  className={`block truncate text-[9px] leading-tight min-[360px]:text-[10px] ${
                    active ? 'font-bold' : 'text-muted'
                  }`}
                  style={active ? { color: z.color } : undefined}
                >
                  {z.label}
                </span>
                <span className="block text-[8px] leading-tight text-muted min-[360px]:text-[9px]">
                  {from}-{to}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
