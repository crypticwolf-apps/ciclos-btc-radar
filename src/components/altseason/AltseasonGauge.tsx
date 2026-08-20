import { CLASSIFICATIONS } from '@/lib/altseason/config';
import { ALTSEASON_ZONES, altseasonZone } from '@/lib/altseason/score';
import { cx } from '@/lib/format';

// =============================================================================
// Marcador del Altseason Score.
//
// Es una BARRA de zonas, no un semicírculo, a propósito: el score representa una
// posición dentro de un recorrido (de dominio de BTC a euforia de altcoins) y
// una barra lo comunica mejor que una aguja, además de escalar sin problemas a
// 320 px sin solapar etiquetas.
//
// El volumen se hace con CSS, no con SVG: la banda tiene que estirarse a lo
// ancho del contenedor y un SVG con `preserveAspectRatio="none"` deformaría en
// el mismo gesto el marcador redondo y sus degradados. Con capas HTML cada
// pieza conserva su forma: la banda se estira, el pomo sigue siendo un círculo.
//
// Las tres capas del relieve, de abajo arriba:
//   1. el hueco  → sombra interior en el carril, como si estuviera rebajado;
//   2. las zonas → degradado vertical claro→base→oscuro, que redondea la banda;
//   3. el brillo → reflejo blanco en la mitad superior, que la hace convexa.
// El pomo repite la idea con un degradado radial descentrado (la luz entra por
// arriba a la izquierda) y proyecta sombra sobre la banda.
// =============================================================================

interface AltseasonGaugeProps {
  /** 0-100, o `null` si no se pudo calcular. */
  score: number | null;
  classification: string;
  phaseLabel: string;
  /** Versión reducida para la pantalla de inicio. */
  compact?: boolean;
}

/** Rango [desde, hasta] de cada zona, tomado de la propia clasificación. */
function zoneRange(index: number): [number, number] {
  return [index === 0 ? 0 : CLASSIFICATIONS[index - 1]!.max, CLASSIFICATIONS[index]!.max];
}

const NEUTRAL = { color: '#94a3b8', light: '#cbd5e1', dark: '#475569' };

export function AltseasonGauge({ score, classification, phaseLabel, compact }: AltseasonGaugeProps) {
  const valid = score != null && Number.isFinite(score);
  const clamped = valid ? Math.max(0, Math.min(100, score)) : 0;
  const zone = valid ? altseasonZone(clamped) : NEUTRAL;

  // El pomo se centra en su valor, pero sin salirse del carril por los bordes.
  const knobLeft = Math.max(2.5, Math.min(97.5, clamped));

  const aria = valid
    ? `Altseason Score ${clamped} de 100. ${classification}. Fase del ciclo de altcoins: ${phaseLabel}.`
    : 'Altseason Score no disponible por falta de datos.';

  return (
    <div className="w-full" role="img" aria-label={aria}>
      {/* Valor grande, legible desde 320 px */}
      <div className="flex items-end justify-center gap-2">
        <span
          className={cx(
            'font-mono font-extrabold leading-none tabular-nums',
            compact ? 'text-4xl' : 'text-5xl sm:text-6xl',
          )}
          style={{
            color: zone.color,
            // El halo hace que el número parezca encendido, no impreso.
            textShadow: valid ? `0 0 26px ${zone.color}59` : undefined,
          }}
        >
          {valid ? clamped : '—'}
        </span>
        <span className="mb-1 text-sm text-muted">/ 100</span>
      </div>
      <p
        className={cx('mt-1.5 text-center font-bold', compact ? 'text-xs' : 'text-sm')}
        style={{ color: valid ? zone.color : undefined }}
      >
        {classification}
      </p>

      {/* Banda de zonas: cada una ocupa su rango real del 0-100 */}
      <div className={compact ? 'mt-3' : 'mt-5'}>
        <div
          className={cx('relative rounded-full', compact ? 'h-5' : 'h-6')}
          style={{
            // Carril rebajado: sombra propia debajo y filo de luz en el borde.
            boxShadow:
              '0 4px 10px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex h-full w-full overflow-hidden rounded-full">
            {ALTSEASON_ZONES.map((z, i) => {
              const [from, to] = zoneRange(i);
              const active = valid && clamped > from && clamped <= to;
              return (
                <div
                  key={z.label}
                  style={{
                    width: `${to - from}%`,
                    background: `linear-gradient(180deg, ${z.light} 0%, ${z.color} 46%, ${z.dark} 100%)`,
                    // Las zonas que no son la actual se apagan pero conservan su
                    // color: bajar solo la opacidad las volvía todas del mismo
                    // marrón sobre el fondo oscuro.
                    filter: active ? undefined : 'saturate(0.7) brightness(0.62)',
                    opacity: active ? 1 : 0.85,
                    boxShadow: active
                      ? `0 0 18px ${z.color}80, inset 0 0 12px rgba(255,255,255,0.25)`
                      : undefined,
                    // Filo entre zonas, para que se lean como tramos.
                    borderRight: i < ALTSEASON_ZONES.length - 1 ? '1px solid rgba(0,0,0,0.35)' : undefined,
                  }}
                />
              );
            })}
          </div>

          {/* Reflejo: convierte la banda plana en un cilindro */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.14) 60%, rgba(255,255,255,0) 100%)',
            }}
          />

          {/* Pomo en la posición EXACTA del score */}
          {valid && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2"
              style={{ left: `${knobLeft}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className={cx('rounded-full', compact ? 'h-6 w-6' : 'h-7 w-7')}
                style={{
                  background: `radial-gradient(circle at 32% 26%, #ffffff 0%, ${zone.light} 30%, ${zone.color} 62%, ${zone.dark} 100%)`,
                  border: '2px solid rgba(255,255,255,0.88)',
                  boxShadow: `0 3px 8px rgba(0,0,0,0.55), 0 0 18px ${zone.color}99, inset 0 -2px 4px rgba(0,0,0,0.30)`,
                }}
              />
            </div>
          )}
        </div>

        {/* Etiquetas en grid: se reparten el ancho y nunca se solapan */}
        <div className={cx('grid grid-cols-5 gap-0.5 text-center', compact ? 'mt-2.5' : 'mt-3')}>
          {ALTSEASON_ZONES.map((z, i) => {
            const [from, to] = zoneRange(i);
            const active = valid && clamped > from && clamped <= to;
            return (
              <div key={z.label} className="min-w-0">
                <span
                  className={cx(
                    'block truncate text-[9px] leading-tight min-[360px]:text-[10px]',
                    active ? 'font-bold' : 'text-muted',
                  )}
                  style={active ? { color: z.color, textShadow: `0 0 14px ${z.color}59` } : undefined}
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
