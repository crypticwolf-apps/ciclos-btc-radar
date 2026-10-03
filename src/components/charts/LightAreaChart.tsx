import { useEffect, useMemo, useRef, useState } from 'react';

// =============================================================================
// Gráfico de área ligero, en SVG propio.
//
// Existe para la pantalla de inicio: su único gráfico era el del precio, y por
// él había que descargar la librería de gráficos entera (~100 KB comprimidos)
// nada más abrir la app. Este hace lo mismo que aquel —área con degradado,
// rejilla, ejes con etiquetas y un indicador al pasar el dedo o el ratón— en
// unas decenas de líneas. Las demás pantallas siguen usando la librería.
// =============================================================================

export interface LightPoint {
  t: number;
  price: number;
}

interface Props {
  points: LightPoint[];
  color?: string;
  /** Etiqueta del eje X y del indicador. */
  formatX: (t: number) => string;
  formatXFull: (t: number) => string;
  formatY: (v: number) => string;
  formatYFull: (v: number) => string;
  className?: string;
}

const PAD = { top: 8, right: 4, bottom: 22, left: 66 };

/** Hasta `count` valores «redondos» entre min y max. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export function LightAreaChart({ points, color = '#f59e0b', formatX, formatXFull, formatY, formatYFull, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (points.length < 2 || size.w === 0) return null;
    const t0 = points[0]!.t;
    const t1 = points[points.length - 1]!.t;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of points) {
      lo = Math.min(lo, p.price);
      hi = Math.max(hi, p.price);
    }
    if (hi === lo) hi = lo + 1;
    const iw = Math.max(1, size.w - PAD.left - PAD.right);
    const ih = Math.max(1, size.h - PAD.top - PAD.bottom);
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * iw;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * ih;
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`).join('');
    const area = `${line}L${x(t1).toFixed(1)},${PAD.top + ih}L${x(t0).toFixed(1)},${PAD.top + ih}Z`;
    const yTicks = niceTicks(lo, hi);
    const xCount = Math.max(2, Math.min(6, Math.floor(iw / 70)));
    // Marcas repartidas por igual, sin repetir etiqueta: en «MÁX» dos marcas
    // podían caer en el mismo año y salir «2015 2015».
    const xTicks = Array.from({ length: xCount }, (_, i) => t0 + ((t1 - t0) * i) / (xCount - 1)).filter(
      (t, i, all) => i === 0 || formatX(t) !== formatX(all[i - 1]!),
    );
    return { x, y, line, area, yTicks, xTicks, iw, ih, t0, t1 };
  }, [points, size, formatX]);

  /** Índice del punto más cercano a la posición horizontal del puntero. */
  const pick = (clientX: number) => {
    const el = box.current;
    if (!el || !geo) return;
    const px = clientX - el.getBoundingClientRect().left;
    const t = geo.t0 + ((px - PAD.left) / geo.iw) * (geo.t1 - geo.t0);
    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid]!.t < t) lo = mid;
      else hi = mid;
    }
    setHover(Math.abs(points[lo]!.t - t) <= Math.abs(points[hi]!.t - t) ? lo : hi);
  };

  const sel = hover != null ? points[hover] : null;

  return (
    <div
      ref={box}
      className={className}
      style={{ position: 'relative', touchAction: 'pan-y' }}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerLeave={() => setHover(null)}
    >
      {geo && (
        <svg width={size.w} height={size.h} role="img" aria-label="Gráfico del precio en el periodo elegido">
          <defs>
            <linearGradient id="lightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.42} />
              <stop offset="95%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          {geo.yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + geo.iw} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--grid-line)" strokeDasharray="3 3" />
              <text x={PAD.left - 6} y={geo.y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {formatY(v)}
              </text>
            </g>
          ))}
          {geo.xTicks.map((t, i) => (
            <text
              key={t}
              x={geo.x(t)}
              y={PAD.top + geo.ih + 15}
              textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}
              fontSize={10}
              fill="var(--text-muted)"
            >
              {formatX(t)}
            </text>
          ))}
          <path d={geo.area} fill="url(#lightAreaGrad)" />
          <path d={geo.line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          {sel && (
            <g>
              <line x1={geo.x(sel.t)} x2={geo.x(sel.t)} y1={PAD.top} y2={PAD.top + geo.ih} stroke="var(--text-muted)" strokeDasharray="3 3" />
              <circle cx={geo.x(sel.t)} cy={geo.y(sel.price)} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5} />
            </g>
          )}
        </svg>
      )}
      {sel && geo && (
        <div
          className="pointer-events-none absolute top-1 rounded-xl px-3 py-2 text-xs shadow-xl"
          style={{
            background: 'var(--tooltip-bg)',
            border: '1px solid var(--tooltip-border)',
            // A la derecha del punto, o a la izquierda si no cabe.
            ...(geo.x(sel.t) > size.w / 2 ? { right: size.w - geo.x(sel.t) + 10 } : { left: geo.x(sel.t) + 10 }),
          }}
        >
          <p className="text-muted">{formatXFull(sel.t)}</p>
          <p className="font-bold" style={{ color }}>
            Precio: {formatYFull(sel.price)}
          </p>
        </div>
      )}
    </div>
  );
}
