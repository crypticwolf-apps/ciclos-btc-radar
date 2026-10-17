import { useId, type ReactNode } from 'react';
import { usePausaFuera } from '@/hooks/usePausaFuera';
import { varsZona, type ZonaBarra } from './zonasLiquidas';

// =============================================================================
// Barra líquida: un tubo de cristal de extremo a extremo, con el líquido dentro.
//
// Es el dibujo de la barra del Altseason, sacado aquí para que lo compartan las
// barras que lo usan (Altseason y miedo y codicia). Cada una pone sus zonas, sus
// extremos y sus rótulos; el tubo es el mismo:
//
//   · los extremos (una moneda, una esfera con un icono) son las puntas del
//     propio tubo, y la escala va de uno a otro: así ocupa todo el ancho y se
//     lee bien en el móvil;
//   · el líquido es un degradado continuo por los colores de las zonas, con
//     volumen, una onda que fluye y burbujas; llega hasta el valor y el resto
//     del recorrido queda tenue;
//   · las marcas van grabadas en el vidrio y una esfera marca el valor exacto;
//   · uno de los extremos puede brillar alrededor (el de la zona extrema en la
//     que está el valor).
//
// Es un SVG con su viewBox, que escala entero sin deformarse; va integrado en la
// tarjeta, con los colores del tema (variables y clases termo-* de index.css).
// Las animaciones (subida, onda y brillo) se apagan con «reducir movimiento».
// =============================================================================

export type { ZonaBarra } from './zonasLiquidas';
export { varsZona } from './zonasLiquidas';

export interface MarcaBarra {
  /** Posición en la escala 0-100. */
  en: number;
  /** Las largas son los cortes de zona. */
  larga: boolean;
}

export interface RotuloBarra {
  en: number;
  texto: string;
}

// Geometría (viewBox 360 × 70).
export const CY = 46;
export const X_IZQ = 22;
export const X_DER = 338;
export const R_EXTREMO = 15;

/** Posición horizontal de un valor 0-100: el 0 en el extremo izquierdo y el 100 en el derecho. */
export function posicionBarra(valor: number): number {
  const s = Math.max(0, Math.min(100, Number.isFinite(valor) ? valor : 0));
  return X_IZQ + (s / 100) * (X_DER - X_IZQ);
}

export const ZONA_NEUTRA: ZonaBarra = { nombre: '—', desde: 0, hasta: 100, color: '#94a3b8', claro: '#cbd5e1', oscuro: '#475569' };

interface BarraLiquidaProps {
  /** 0-100, o `null` sin dato (se dibuja el tubo vacío). */
  valor: number | null;
  zonas: readonly ZonaBarra[];
  /** Zona del valor: colorea la esfera. */
  zona: ZonaBarra;
  marcas: readonly MarcaBarra[];
  rotulos: readonly RotuloBarra[];
  /** Líneas finas dentro del canal, entre zonas. */
  separadores: readonly number[];
  /** Dibujo de cada extremo, centrado en (X_IZQ | X_DER, CY). Recibe el prefijo de ids. */
  extremoIzq: (id: string) => ReactNode;
  extremoDer: (id: string) => ReactNode;
  /** Extremo que brilla alrededor, y con qué color. */
  brillo?: { en: 'izq' | 'der'; color: string } | null;
}

export function BarraLiquida({
  valor,
  zonas,
  zona,
  marcas,
  rotulos,
  separadores,
  extremoIzq,
  extremoDer,
  brillo,
}: BarraLiquidaProps) {
  const id = useId().replace(/:/g, '');
  const pausaFuera = usePausaFuera<HTMLDivElement>();
  const valido = valor != null && Number.isFinite(valor);
  const xs = posicionBarra(valido ? valor : 0);

  return (
    <div ref={pausaFuera} className="relative">
    <svg viewBox="0 6 360 70" className="block h-auto w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}liq`} x1={X_IZQ} x2={X_DER} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={zonas[0]!.color} />
          {zonas.map((z) => (
            <stop key={z.nombre} offset={`${(z.desde + z.hasta) / 2}%`} stopColor={z.color} />
          ))}
          <stop offset="100%" stopColor={zonas[zonas.length - 1]!.color} />
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
        <radialGradient id={`${id}esfera`} cx="32%" cy="26%" r="75%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="28%" stopColor={zona.claro} />
          <stop offset="60%" stopColor={zona.color} />
          <stop offset="100%" stopColor={zona.oscuro} />
        </radialGradient>
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
          <rect x={X_IZQ} y={CY - 10} width={X_DER - X_IZQ} height="20" />
        </clipPath>
        <clipPath id={`${id}nivel`}>
          <rect x={X_IZQ} y={CY - 10} width={xs - X_IZQ} height="20" />
        </clipPath>
      </defs>

      {/* Sombra sobre la tarjeta */}
      <ellipse cx="180" cy={CY + 22} rx="168" ry="5" fill="var(--termo-sombra)" filter={`url(#${id}sombra)`} />

      {/* Marcas grabadas en el vidrio: las largas, en los cortes de zona */}
      {marcas.map((m) => (
        <line
          key={m.en}
          x1={posicionBarra(m.en)}
          x2={posicionBarra(m.en)}
          y1={CY - (m.larga ? 27 : 23)}
          y2={CY - 19.5}
          stroke="var(--termo-grabado)"
          strokeOpacity={m.larga ? 1 : 0.45}
          strokeWidth={m.larga ? 1.4 : 1}
        />
      ))}
      {rotulos.map((r) => (
        <text
          key={r.en}
          x={posicionBarra(r.en)}
          y={CY - 31}
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill="var(--text-muted)"
          className="font-mono"
        >
          {r.texto}
        </text>
      ))}

      {/* Tubo de vidrio de punta a punta */}
      <rect x="4" y={CY - 18} width="352" height="36" rx="18" fill="var(--termo-vidrio)" stroke="var(--termo-vidrio-borde)" strokeWidth="1.2" />

      {/* Recorrido completo, tenue */}
      <g clipPath={`url(#${id}canal)`}>
        <rect x={X_IZQ} y={CY - 10} width={X_DER - X_IZQ} height="20" fill={`url(#${id}liq)`} opacity="0.2" />
      </g>
      {/* Líquido: sale del extremo izquierdo y llega hasta el valor */}
      {valido && (
        <>
          <g clipPath={`url(#${id}canal)`} filter={`url(#${id}brillo)`}>
            <rect className="termo-liquido" x={X_IZQ} y={CY - 10} width={xs - X_IZQ} height="20" fill={`url(#${id}liq)`} />
          </g>
          <g clipPath={`url(#${id}canal)`}>
            <rect className="termo-liquido" x={X_IZQ} y={CY - 10} width={xs - X_IZQ} height="20" fill={`url(#${id}vol)`} />
          </g>
        </>
      )}
      {/* Separadores de zona dentro del canal */}
      {separadores.map((s) => (
        <line
          key={s}
          x1={posicionBarra(s)}
          x2={posicionBarra(s)}
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

      {/* Brillo del extremo de la zona en la que está el valor */}
      {brillo && (
        <g className="alt-halo">
          <circle cx={brillo.en === 'izq' ? X_IZQ : X_DER} cy={CY} r="22" fill={brillo.color} filter={`url(#${id}halo)`} />
          <circle
            cx={brillo.en === 'izq' ? X_IZQ : X_DER}
            cy={CY}
            r="18"
            fill="none"
            stroke={brillo.color}
            strokeWidth="2.5"
            opacity="0.9"
          />
        </g>
      )}

      {extremoIzq(id)}
      {extremoDer(id)}

      {/* Esfera en la posición exacta del valor */}
      {valido && (
        <>
          <circle cx={xs + 1} cy={CY + 3} r="11" fill="#000" opacity="0.35" filter={`url(#${id}sombra)`} />
          <circle cx={xs} cy={CY} r="11" fill={`url(#${id}esfera)`} stroke="#fff" strokeOpacity="0.9" strokeWidth="2" />
          <ellipse cx={xs - 3.5} cy={CY - 4.5} rx="3.5" ry="2" fill="#fff" opacity="0.7" />
        </>
      )}
    </svg>

    {/* La onda que fluye, en su propia capa: moverla dentro del dibujo obligaba
        a repintar en cada fotograma el líquido con su brillo (un desenfoque).
        Va recortada al líquido y sin pisar las puntas ni la esfera, que en el
        dibujo quedaban por encima. */}
    {valido && (
      <svg viewBox="0 6 360 70" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          {/* Onda que fluye por dentro del líquido, con burbujas */}
          <pattern id={`${id}ola`} x="0" y={CY - 10} width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 5 Q10 2 20 5 T40 5 L40 7.2 Q30 10.2 20 7.2 Q10 4.2 0 7.2 Z" fill="#fff" opacity="0.3" />
            <circle cx="9" cy="13" r="1.3" fill="#fff" opacity="0.45" />
            <circle cx="27" cy="15.5" r="0.9" fill="#fff" opacity="0.35" />
            <circle cx="33" cy="11" r="0.7" fill="#fff" opacity="0.3" />
          </pattern>
          <clipPath id={`${id}olanivel`}>
            <rect x={X_IZQ} y={CY - 10} width={xs - X_IZQ} height="20" />
          </clipPath>
          {/* Sin pisar los extremos ni la esfera: un recorte por círculo (el
              rectángulo menos el círculo, par-impar), anidados. */}
          {HUECOS.map((h) => (
            <clipPath key={h} id={`${id}sin${h}`}>
              <path clipRule="evenodd" d={`M -20 -20 H 380 V 100 H -20 Z ${circulo(h === 'izq' ? X_IZQ : h === 'der' ? X_DER : xs, h === 'esfera' ? 11 : R_EXTREMO)}`} />
            </clipPath>
          ))}
        </defs>
        <g clipPath={`url(#${id}olanivel)`}>
          <g clipPath={`url(#${id}sinizq)`}>
            <g clipPath={`url(#${id}sinder)`}>
              <g clipPath={`url(#${id}sinesfera)`}>
                <rect className="alt-ola" x="-10" y={CY - 10} width="380" height="20" fill={`url(#${id}ola)`} />
              </g>
            </g>
          </g>
        </g>
      </svg>
    )}
    </div>
  );
}

const HUECOS = ['izq', 'der', 'esfera'] as const;

/** Círculo como trozo de trazado (para restarlo de un recorte). */
const circulo = (cx: number, r: number) => `M ${cx - r} ${CY} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

// --- Extremos ----------------------------------------------------------------

/** Moneda de Bitcoin: el bulbo del que sale el líquido. */
export function MonedaBitcoin({ id, cx }: { id: string; cx: number }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}btc`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff1d6" />
          <stop offset="35%" stopColor="#ffb547" />
          <stop offset="75%" stopColor="#f7931a" />
          <stop offset="100%" stopColor="#a35400" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={CY + 1.5} r={R_EXTREMO} fill="#8a4b00" />
      <circle cx={cx} cy={CY} r={R_EXTREMO} fill={`url(#${id}btc)`} filter={`url(#${id}brillo)`} />
      <circle cx={cx} cy={CY} r="11.5" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
      <text x={cx} y={CY + 5.5} textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff">
        ₿
      </text>
      <ellipse cx={cx - 6} cy={CY - 8} rx="5.5" ry="2.8" fill="#fff" opacity="0.6" transform={`rotate(-25 ${cx - 6} ${CY - 8})`} />
    </g>
  );
}

/** Moneda de Ethereum. */
export function MonedaEthereum({ id, cx }: { id: string; cx: number }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}eth`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#eef1ff" />
          <stop offset="35%" stopColor="#97a8f5" />
          <stop offset="75%" stopColor="#627eea" />
          <stop offset="100%" stopColor="#2c3a8a" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={CY + 1.5} r={R_EXTREMO} fill="#2c3a8a" />
      <circle cx={cx} cy={CY} r={R_EXTREMO} fill={`url(#${id}eth)`} />
      <circle cx={cx} cy={CY} r="11.5" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
      <polygon points={`${cx},${CY - 10} ${cx + 6},${CY + 0.5} ${cx},${CY + 3.8} ${cx - 6},${CY + 0.5}`} fill="#fff" opacity="0.95" />
      <polygon points={`${cx},${CY - 10} ${cx + 6},${CY + 0.5} ${cx},${CY + 3.8}`} fill="#dfe5ff" opacity="0.9" />
      <polygon points={`${cx},${CY + 5.2} ${cx + 6},${CY + 1.9} ${cx},${CY + 10.5} ${cx - 6},${CY + 1.9}`} fill="#fff" opacity="0.9" />
      <polygon points={`${cx},${CY + 5.2} ${cx + 6},${CY + 1.9} ${cx},${CY + 10.5}`} fill="#dfe5ff" opacity="0.85" />
      <ellipse cx={cx - 6} cy={CY - 8} rx="5.5" ry="2.8" fill="#fff" opacity="0.55" transform={`rotate(-25 ${cx - 6} ${CY - 8})`} />
    </g>
  );
}

/** Esfera de cristal del color de una zona, con un icono dibujado dentro. */
export function EsferaExtremo({
  id,
  cx,
  nombre,
  zona,
  children,
}: {
  id: string;
  cx: number;
  /** Sufijo único del degradado dentro de esta barra. */
  nombre: string;
  zona: ZonaBarra;
  /** El icono, dibujado alrededor de (cx, CY). */
  children: ReactNode;
}) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}${nombre}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="30%" stopColor={zona.claro} />
          <stop offset="72%" stopColor={zona.color} />
          <stop offset="100%" stopColor={zona.oscuro} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={CY + 1.5} r={R_EXTREMO} fill={zona.oscuro} />
      <circle cx={cx} cy={CY} r={R_EXTREMO} fill={`url(#${id}${nombre})`} />
      {children}
      <ellipse cx={cx - 7} cy={CY - 9} rx="4.5" ry="2.2" fill="#fff" opacity="0.45" transform={`rotate(-25 ${cx - 7} ${CY - 9})`} />
    </g>
  );
}

// --- Leyenda -----------------------------------------------------------------

/** Una celda por zona, con su nombre y su rango; la actual, encendida. */
export function LeyendaZonas({
  zonas,
  activa,
  rango,
  className = 'grid-cols-5',
}: {
  zonas: readonly ZonaBarra[];
  /** Índice de la zona encendida, o -1. */
  activa: number;
  /** Texto pequeño bajo el nombre (el rango), o nada. */
  rango?: (z: ZonaBarra) => string | null;
  /** Columnas de la rejilla y margen. */
  className?: string;
}) {
  return (
    <div className={`grid gap-1 ${className}`}>
      {zonas.map((z, i) => {
        const activo = i === activa;
        const texto = rango?.(z);
        return (
          <div
            key={z.nombre}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-center ${activo ? 'termo-celda-activa termo-texto' : 'termo-celda text-muted'}`}
            style={varsZona(z)}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: z.color, boxShadow: activo ? `0 0 8px ${z.color}` : 'none', opacity: activo ? 1 : 0.85 }}
            />
            <span className="text-[10px] font-bold leading-tight">{z.nombre}</span>
            {texto && <span className="font-mono text-[9px] leading-none opacity-80">{texto}</span>}
          </div>
        );
      })}
    </div>
  );
}
