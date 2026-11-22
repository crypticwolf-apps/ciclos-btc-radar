import { memo, useId, useMemo } from 'react';
import { usePriceHistory } from '@/hooks/useBitcoinMarketData';
import { useCurrency } from '@/contexts/CurrencyContext';
import { cx, formatPercent } from '@/lib/format';

// =============================================================================
// Inicio: el precio de Bitcoin de los últimos 7 días, en una línea bajo el
// precio en vivo. Da contexto de un vistazo (¿viene de subir o de bajar?) sin
// tener que ir al gráfico de Ciclos.
//
// Un SVG sencillo, sin la librería de gráficos: Inicio no la descarga. Pide el
// mismo histórico de 7 días que el gráfico del precio (se comparte la caché) y
// su hueco mide siempre lo mismo, cargue o no, para que nada salte.
// =============================================================================

const ANCHO = 100;
const ALTO = 32;
const MARGEN = 2;

export const Minigrafica7d = memo(function Minigrafica7d() {
  const { currency } = useCurrency();
  const query = usePriceHistory('7', currency);
  const puntos = query.data?.data?.points;
  // Sin «:» de useId: dentro de url(#…) no son de fiar.
  const degradado = `mini7d${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const dibujo = useMemo(() => {
    if (!puntos || puntos.length < 2) return null;
    const precios = puntos.map((p) => p.price);
    const bajo = Math.min(...precios);
    const rango = Math.max(...precios) - bajo || 1;
    const xy = precios.map((precio, i) => [
      (i / (precios.length - 1)) * ANCHO,
      MARGEN + (1 - (precio - bajo) / rango) * (ALTO - 2 * MARGEN),
    ]);
    const linea = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(2)},${y!.toFixed(2)}`).join('');
    return {
      linea,
      area: `${linea}L${ANCHO},${ALTO}L0,${ALTO}Z`,
      cambio: (precios[precios.length - 1]! / precios[0]! - 1) * 100,
    };
  }, [puntos]);

  const sube = (dibujo?.cambio ?? 0) >= 0;

  return (
    <div className="mx-auto mt-3 flex h-8 max-w-xs items-center gap-3">
      {dibujo && (
        <>
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            preserveAspectRatio="none"
            className={cx('h-8 min-w-0 flex-1 overflow-visible', sube ? 'text-bull' : 'text-bear')}
            role="img"
            aria-label={`Precio de los últimos 7 días: ${formatPercent(dibujo.cambio)}`}
          >
            <defs>
              <linearGradient id={degradado} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={dibujo.area} fill={`url(#${degradado})`} />
            <path
              d={dibujo.linea}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span className="shrink-0 text-[11px] text-muted" aria-hidden="true">
            7 días{' '}
            <span className={cx('font-bold', sube ? 'text-bull' : 'text-bear')}>{formatPercent(dibujo.cambio)}</span>
          </span>
        </>
      )}
    </div>
  );
});
