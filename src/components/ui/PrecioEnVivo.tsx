import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { MarketData } from '@/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useLiveSpot } from '@/hooks/useRealtime';
import { useEnVista } from '@/hooks/useEnVista';
import { useCambioVisible } from '@/hooks/useCambioVisible';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { cx, formatPercent } from '@/lib/format';

/**
 * El precio de Bitcoin en vivo, centrado, con la variación de 24 h y de cuándo
 * es. Va en la tarjeta grande de Inicio (móvil) y, en escritorio, encabeza el
 * cuadro «Precio de Bitcoin». Es lo único que se redibuja con cada precio.
 */
export function PrecioEnVivo({ data }: { data: MarketData }) {
  const { formatFromUsd } = useCurrency();
  // Fuera de la pantalla (en la hoja de escritorio, al bajar) no se redibuja.
  const [ref, visible] = useEnVista<HTMLDivElement>();
  const spot = useLiveSpot(visible);

  // El precio del WebSocket manda cuando el canal está abierto; si no, se usa el
  // del backend (que ya es real, solo que con menos frecuencia).
  const precio = spot.isLive ? spot.ticker!.priceUsd : data.bitcoin.precio;
  const cambio24h = spot.isLive ? spot.ticker!.changePct24h : data.bitcoin.cambio24h;
  // Sin dato de variación no se pinta ni verde ni rojo: se queda neutro.
  const up = (cambio24h ?? 0) >= 0;
  const precioTexto = formatFromUsd(precio);
  // Verde o rojo solo cuando la cifra que se ve sube o baja, no por céntimos.
  const tick = useCambioVisible(precio, precioTexto);

  return (
    <>
      <div ref={ref} className="flex flex-wrap items-end justify-center gap-2.5">
        {/* aria-live desactivado a propósito: anunciar cada tick del precio
            haría inusable el lector de pantalla. Sin transición de color: con
            un precio cada medio segundo estaba activa casi siempre y cada
            fotograma repintaba la tarjeta entera, con su fondo desenfocado.
            Tampoco en capa propia (`will-change`): Safari de iPhone dejaba de
            repintar el número y el precio parecía congelado. */}
        <h1
          aria-live="off"
          className={cx(
            'font-mono text-[2rem] font-extrabold leading-none tracking-[-0.05em] tabular-nums sm:text-5xl',
            tick === 'up'
              ? 'text-bull'
              : tick === 'down'
                ? 'text-bear'
                : 'text-primary',
          )}
        >
          {precioTexto}
        </h1>
        <span className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold', up ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear')}>
          {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
          {formatPercent(cambio24h)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {/* Sin WebSocket, la hora es la de obtención en el SERVIDOR, no la
            de llegada al navegador: con la caché pueden ser minutos. */}
        <FreshnessTag
          freshness={spot.isLive ? 'vivo' : data.frescura.mercado?.reserva ? 'cache' : 'actualizado'}
          at={spot.isLive ? null : (data.frescura.mercado?.at ?? data.bitcoin.actualizado)}
          source={spot.isLive ? 'Binance (WebSocket)' : 'proveedor de mercado'}
        />
        {spot.isLive && spot.ticker && (
          <span className="text-[11px] text-muted">
            24 h: {formatFromUsd(spot.ticker.low24h)} – {formatFromUsd(spot.ticker.high24h)}
          </span>
        )}
      </div>
    </>
  );
}
