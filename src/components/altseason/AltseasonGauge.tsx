import { useId, type CSSProperties } from 'react';
import { CLASSIFICATIONS } from '@/lib/altseason/config';
import { ALTSEASON_ZONES, altseasonZoneIndex, type AltseasonZone } from '@/lib/altseason/score';

// =============================================================================
// Marcador del Altseason Score: un tubo de cristal de moneda a moneda.
//
// Las monedas son los extremos del propio tubo: Bitcoin a la izquierda, de
// donde sale el líquido (como el bulbo de un termómetro), y Ethereum cerrándolo
// por la derecha. La escala va de una a otra: el 0 en la de Bitcoin y el 100 en
// la de Ethereum. Así la barra ocupa todo el ancho y se lee bien en el móvil.
//
// El líquido es un degradado continuo por los colores de las zonas, del naranja
// de Bitcoin al morado de la euforia, con volumen, una onda que fluye y
// burbujas; llega hasta el score y el resto del recorrido queda tenue. Los
// cortes de medición van grabados en el vidrio: cada 5, largos y numerados en
// los cortes de zona. Una esfera marca el valor exacto. Con el score en la zona
// de Bitcoin (0-20) su moneda brilla alrededor; en la de euforia (80-100), la de
// Ethereum.
//
// Es un SVG con su viewBox, que escala entero sin deformarse; va integrado en la
// tarjeta, con los colores del tema (variables y clases termo-* de index.css,
// las mismas que el termómetro de oportunidad). Las animaciones (subida, onda y
// brillo) se apagan con «reducir movimiento».
// =============================================================================

interface AltseasonGaugeProps {
  /** 0-100, o `null` si no se pudo calcular. */
  score: number | null;
  classification: string;
  phaseLabel: string;
  /** Versión reducida para la pantalla de inicio. */
  compact?: boolean;
}

// Geometría (viewBox 360 × 70).
const CY = 46;
const BTC_X = 22;
const ETH_X = 338;
const COIN_R = 15;

/** Posición horizontal de un valor: 0 en la moneda de Bitcoin, 100 en la de Ethereum. */
export function posicionAltseason(score: number): number {
  const s = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  return BTC_X + (s / 100) * (ETH_X - BTC_X);
}

/** Qué moneda brilla: la de Bitcoin en su zona (la primera), la de Ethereum en la euforia (la última). */
export function monedaEncendida(score: number | null): 'btc' | 'eth' | null {
  if (score == null || !Number.isFinite(score)) return null;
  const zona = altseasonZoneIndex(score);
  return zona === 0 ? 'btc' : zona === ALTSEASON_ZONES.length - 1 ? 'eth' : null;
}

/** Rango [desde, hasta] de cada zona, tomado de la propia clasificación. */
function zoneRange(index: number): [number, number] {
  return [index === 0 ? 0 : CLASSIFICATIONS[index - 1]!.max, CLASSIFICATIONS[index]!.max];
}

const NEUTRAL: AltseasonZone = { label: '—', color: '#94a3b8', light: '#cbd5e1', dark: '#475569' };

/** Colores de una zona como variables CSS: index.css elige la variante que se lee en cada tema. */
const varsDe = (z: AltseasonZone) => ({ '--tc-color': z.color, '--tc-claro': z.light, '--tc-oscuro': z.dark }) as CSSProperties;

export function AltseasonGauge({ score, classification, phaseLabel, compact }: AltseasonGaugeProps) {
  const id = useId().replace(/:/g, '');
  const valid = score != null && Number.isFinite(score);
  const clamped = valid ? Math.round(Math.max(0, Math.min(100, score))) : 0;
  const zoneIndex = valid ? altseasonZoneIndex(clamped) : -1;
  const zone = zoneIndex >= 0 ? ALTSEASON_ZONES[zoneIndex]! : NEUTRAL;
  const xs = posicionAltseason(clamped);
  const brilla = monedaEncendida(valid ? clamped : null);
  const cortes = [0, ...CLASSIFICATIONS.map((c) => c.max)];

  const aria = valid
    ? `Altseason Score ${clamped} de 100. ${classification}. Fase del ciclo de altcoins: ${phaseLabel}.`
    : 'Altseason Score no disponible por falta de datos.';

  return (
    // Ancho máximo: el dibujo escala entero y, a todo el ancho de una tarjeta de
    // escritorio, la barra y sus números salían gigantes.
    <div className="mx-auto w-full max-w-[560px]" role="img" aria-label={aria}>
      {/* Valor y zona */}
      <div className="mb-1 flex items-end justify-between gap-3">
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span
            className={`termo-numero font-mono font-extrabold leading-none tabular-nums ${compact ? 'text-4xl' : 'text-5xl sm:text-6xl'}`}
            style={varsDe(zone)}
          >
            {valid ? clamped : '—'}
          </span>
          <span className="text-xs font-semibold text-muted">/ 100</span>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1">
          <span
            className={`termo-etiqueta whitespace-nowrap rounded-full px-3 py-1 font-bold ${compact ? 'text-xs' : 'text-[13px] sm:text-sm'}`}
            style={varsDe(zone)}
          >
            {classification}
          </span>
          {!compact && <span className="text-right text-[11px] text-muted">{phaseLabel}</span>}
        </div>
      </div>

      <svg viewBox="0 6 360 70" className="block h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}liq`} x1={BTC_X} x2={ETH_X} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={ALTSEASON_ZONES[0]!.color} />
            {ALTSEASON_ZONES.map((z, i) => {
              const [from, to] = zoneRange(i);
              return <stop key={z.label} offset={`${(from + to) / 2}%`} stopColor={z.color} />;
            })}
            <stop offset="100%" stopColor={ALTSEASON_ZONES[ALTSEASON_ZONES.length - 1]!.color} />
          </linearGradient>
          <linearGradient id={`${id}vol`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="30%" stopColor="#fff" stopOpacity="0.06" />
            <stop offset="70%" stopColor="#000" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id={`${id}vidrio`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.18" />
          </linearGradient>
          <radialGradient id={`${id}btc`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff1d6" />
            <stop offset="35%" stopColor="#ffb547" />
            <stop offset="75%" stopColor="#f7931a" />
            <stop offset="100%" stopColor="#a35400" />
          </radialGradient>
          <radialGradient id={`${id}eth`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#eef1ff" />
            <stop offset="35%" stopColor="#97a8f5" />
            <stop offset="75%" stopColor="#627eea" />
            <stop offset="100%" stopColor="#2c3a8a" />
          </radialGradient>
          <radialGradient id={`${id}esfera`} cx="32%" cy="26%" r="75%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="28%" stopColor={zone.light} />
            <stop offset="60%" stopColor={zone.color} />
            <stop offset="100%" stopColor={zone.dark} />
          </radialGradient>
          {/* Onda que fluye por dentro del líquido, con burbujas */}
          <pattern id={`${id}ola`} x="0" y={CY - 10} width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 5 Q10 2 20 5 T40 5 L40 7.2 Q30 10.2 20 7.2 Q10 4.2 0 7.2 Z" fill="#fff" opacity="0.3" />
            <circle cx="9" cy="13" r="1.3" fill="#fff" opacity="0.45" />
            <circle cx="27" cy="15.5" r="0.9" fill="#fff" opacity="0.35" />
            <circle cx="33" cy="11" r="0.7" fill="#fff" opacity="0.3" />
          </pattern>
          {/* Filtros en coordenadas del dibujo: relativos a cada figura, el brillo
              de una franja estrecha salía recortado en rectángulo. */}
          <filter id={`${id}brillo`} filterUnits="userSpaceOnUse" x="-20" y="-20" width="400" height="120">
            <feGaussianBlur stdDeviation="4.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${id}sombra`} filterUnits="userSpaceOnUse" x="-20" y="-20" width="400" height="120">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
          <filter id={`${id}halo`} filterUnits="userSpaceOnUse" x="-30" y="-30" width="420" height="140">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <clipPath id={`${id}canal`}>
            <rect x={BTC_X} y={CY - 10} width={ETH_X - BTC_X} height="20" />
          </clipPath>
          <clipPath id={`${id}nivel`}>
            <rect x={BTC_X} y={CY - 10} width={xs - BTC_X} height="20" />
          </clipPath>
        </defs>

        {/* Sombra sobre la tarjeta */}
        <ellipse cx="180" cy={CY + 22} rx="168" ry="5" fill="var(--termo-sombra)" filter={`url(#${id}sombra)`} />

        {/* Cortes de medición: cada 5, largos y numerados en los cortes de zona */}
        {Array.from({ length: 21 }, (_, i) => i * 5).map((s) => {
          const corte = cortes.includes(s);
          return (
            <line
              key={s}
              x1={posicionAltseason(s)}
              x2={posicionAltseason(s)}
              y1={CY - (corte ? 27 : 23)}
              y2={CY - 19.5}
              stroke="var(--termo-grabado)"
              strokeOpacity={corte ? 1 : 0.45}
              strokeWidth={corte ? 1.4 : 1}
            />
          );
        })}
        {cortes.map((s) => (
          <text
            key={s}
            x={posicionAltseason(s)}
            y={CY - 31}
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="var(--text-muted)"
            className="font-mono"
          >
            {s}
          </text>
        ))}

        {/* Tubo de vidrio de punta a punta */}
        <rect x="4" y={CY - 18} width="352" height="36" rx="18" fill="var(--termo-vidrio)" stroke="var(--termo-vidrio-borde)" strokeWidth="1.2" />

        {/* Recorrido completo, tenue */}
        <g clipPath={`url(#${id}canal)`}>
          <rect x={BTC_X} y={CY - 10} width={ETH_X - BTC_X} height="20" fill={`url(#${id}liq)`} opacity="0.2" />
        </g>
        {/* Líquido: sale de la moneda de Bitcoin y llega hasta el score */}
        {valid && (
          <>
            <g clipPath={`url(#${id}canal)`} filter={`url(#${id}brillo)`}>
              <rect className="termo-liquido" x={BTC_X} y={CY - 10} width={xs - BTC_X} height="20" fill={`url(#${id}liq)`} />
            </g>
            <g clipPath={`url(#${id}canal)`}>
              <rect className="termo-liquido" x={BTC_X} y={CY - 10} width={xs - BTC_X} height="20" fill={`url(#${id}vol)`} />
              <g clipPath={`url(#${id}nivel)`}>
                <rect className="alt-ola" x="-10" y={CY - 10} width="380" height="20" fill={`url(#${id}ola)`} />
              </g>
            </g>
          </>
        )}
        {/* Separadores de zona dentro del canal */}
        {cortes.slice(1, -1).map((s) => (
          <line
            key={s}
            x1={posicionAltseason(s)}
            x2={posicionAltseason(s)}
            y1={CY - 10}
            y2={CY + 10}
            stroke="#fff"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        ))}

        {/* Reflejos del vidrio */}
        <rect x="4" y={CY - 18} width="352" height="36" rx="18" fill={`url(#${id}vidrio)`} />
        <rect x="44" y={CY - 14} width="272" height="3" rx="1.5" fill="#fff" opacity="0.55" />

        {/* Brillo de la moneda cuya zona marca el score */}
        {brilla && (
          <g className="alt-halo">
            <circle cx={brilla === 'btc' ? BTC_X : ETH_X} cy={CY} r="22" fill={brilla === 'btc' ? '#f7931a' : '#8ea2ff'} filter={`url(#${id}halo)`} />
            <circle
              cx={brilla === 'btc' ? BTC_X : ETH_X}
              cy={CY}
              r="18"
              fill="none"
              stroke={brilla === 'btc' ? '#f7931a' : '#8ea2ff'}
              strokeWidth="2.5"
              opacity="0.9"
            />
          </g>
        )}

        {/* Moneda de Bitcoin: el bulbo del que sale el líquido */}
        <g>
          <circle cx={BTC_X} cy={CY + 1.5} r={COIN_R} fill="#8a4b00" />
          <circle cx={BTC_X} cy={CY} r={COIN_R} fill={`url(#${id}btc)`} filter={`url(#${id}brillo)`} />
          <circle cx={BTC_X} cy={CY} r="11.5" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
          <text x={BTC_X} y={CY + 5.5} textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff">
            ₿
          </text>
          <ellipse cx={BTC_X - 6} cy={CY - 8} rx="5.5" ry="2.8" fill="#fff" opacity="0.6" transform={`rotate(-25 ${BTC_X - 6} ${CY - 8})`} />
        </g>
        {/* Moneda de Ethereum: cierra el tubo por el lado de las altcoins */}
        <g>
          <circle cx={ETH_X} cy={CY + 1.5} r={COIN_R} fill="#2c3a8a" />
          <circle cx={ETH_X} cy={CY} r={COIN_R} fill={`url(#${id}eth)`} />
          <circle cx={ETH_X} cy={CY} r="11.5" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
          <polygon points={`${ETH_X},${CY - 10} ${ETH_X + 6},${CY + 0.5} ${ETH_X},${CY + 3.8} ${ETH_X - 6},${CY + 0.5}`} fill="#fff" opacity="0.95" />
          <polygon points={`${ETH_X},${CY - 10} ${ETH_X + 6},${CY + 0.5} ${ETH_X},${CY + 3.8}`} fill="#dfe5ff" opacity="0.9" />
          <polygon points={`${ETH_X},${CY + 5.2} ${ETH_X + 6},${CY + 1.9} ${ETH_X},${CY + 10.5} ${ETH_X - 6},${CY + 1.9}`} fill="#fff" opacity="0.9" />
          <polygon points={`${ETH_X},${CY + 5.2} ${ETH_X + 6},${CY + 1.9} ${ETH_X},${CY + 10.5}`} fill="#dfe5ff" opacity="0.85" />
          <ellipse cx={ETH_X - 6} cy={CY - 8} rx="5.5" ry="2.8" fill="#fff" opacity="0.55" transform={`rotate(-25 ${ETH_X - 6} ${CY - 8})`} />
        </g>

        {/* Esfera en la posición exacta del score */}
        {valid && (
          <>
            <circle cx={xs + 1} cy={CY + 3} r="11" fill="#000" opacity="0.35" filter={`url(#${id}sombra)`} />
            <circle cx={xs} cy={CY} r="11" fill={`url(#${id}esfera)`} stroke="#fff" strokeOpacity="0.9" strokeWidth="2" />
            <ellipse cx={xs - 3.5} cy={CY - 4.5} rx="3.5" ry="2" fill="#fff" opacity="0.7" />
          </>
        )}
      </svg>

      {/* Leyenda: una celda por zona, con su rango; la actual, encendida */}
      <div className={`grid grid-cols-5 gap-1 ${compact ? 'mt-1' : 'mt-2'}`}>
        {ALTSEASON_ZONES.map((z, i) => {
          const [from, to] = zoneRange(i);
          const activo = i === zoneIndex;
          return (
            <div
              key={z.label}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-center ${activo ? 'termo-celda-activa termo-texto' : 'termo-celda text-muted'}`}
              style={varsDe(z)}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: z.color, boxShadow: activo ? `0 0 8px ${z.color}` : 'none', opacity: activo ? 1 : 0.85 }}
              />
              <span className="text-[10px] font-bold leading-tight">{z.label}</span>
              <span className="font-mono text-[9px] leading-none opacity-80">
                {from}–{to}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
