import { lazy, Suspense } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { MarketData } from '@/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useLiveSpot } from '@/hooks/useRealtime';
import { useCambioVisible } from '@/hooks/useCambioVisible';
import { Card } from '@/components/ui/Card';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { RuedaFase } from '@/components/ui/RuedaFase';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { DeferUntilVisible } from '@/components/ui/DeferUntilVisible';
import { cx, formatPercent } from '@/lib/format';

// Las tarjetas de debajo de la del precio (Altseason con su cálculo en vivo, la
// temperatura y el miedo y codicia, con sus barras) se descargan al acercarse a
// pantalla, no en la carga inicial: lo primero que se ve abre antes.
const AltseasonHomeCard = lazy(() =>
  import('@/components/altseason/AltseasonHomeCard').then((m) => ({ default: m.AltseasonHomeCard })),
);
const OportunidadHomeCard = lazy(() =>
  import('@/components/views/OportunidadHomeCard').then((m) => ({ default: m.OportunidadHomeCard })),
);
const MiedoCodiciaHomeCard = lazy(() =>
  import('@/components/views/MiedoCodiciaHomeCard').then((m) => ({ default: m.MiedoCodiciaHomeCard })),
);

export function HomeView({
  data,
  onGoToScore,
  onGoToAltseason,
  onGoToPrice,
  onGoToPhase,
  onGoToFearGreed,
}: {
  data: MarketData;
  onGoToScore?: () => void;
  onGoToAltseason?: () => void;
  /** Al gráfico del precio, que vive en Ciclos → Ciclo BTC. */
  onGoToPrice?: () => void;
  /** A la tarjeta «Fase actual», al final de Ciclos → Ciclo BTC. */
  onGoToPhase?: () => void;
  /** A la tarjeta del índice de miedo y codicia, en Análisis. */
  onGoToFearGreed?: () => void;
}) {
  const { formatFromUsd } = useCurrency();
  const spot = useLiveSpot();

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
    <div className="space-y-3 sm:space-y-4">
      <Card className="liquid-hero !p-4 sm:!p-6" accent={data.fase.color}>
        {/* Precio en vivo, centrado */}
        <div className="flex flex-wrap items-end justify-center gap-2.5">
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

        {/* Fase estimada del ciclo, en la rueda de fases. `memo`: no se redibuja
            con cada precio en vivo. */}
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="mb-1 text-center text-[11px] text-muted">Fase estimada del ciclo</p>
          <RuedaFase fase={data.fase} compact />
        </div>

        {/* Los dos accesos, uno al lado del otro */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {/* El gráfico del precio está en Ciclos → Ciclo BTC, el primero. */}
          <a
            href="?vista=ciclos"
            onClick={(event) => {
              event.preventDefault();
              onGoToPrice?.();
            }}
            className="liquid-action inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-center text-[13px] font-bold leading-tight text-secondary sm:gap-1.5 sm:text-sm"
          >
            Ver precio de Bitcoin
            <ArrowRight size={15} className="shrink-0" aria-hidden="true" />
          </a>
          {/* Y la fase, con sus señales, riesgos y oportunidades, al final de la misma pestaña. */}
          <a
            href="?vista=ciclos#fase-actual"
            onClick={(event) => {
              event.preventDefault();
              onGoToPhase?.();
            }}
            className="liquid-action inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-center text-[13px] font-bold leading-tight text-secondary sm:gap-1.5 sm:text-sm"
          >
            Ver fase del ciclo
            <ArrowRight size={15} className="shrink-0" aria-hidden="true" />
          </a>
        </div>
      </Card>

      {/* Marcador de Altseason. Se monta al acercarse a pantalla para no meter
          otra petición en la carga inicial; el análisis completo (señales,
          métricas y ranking) vive en Ciclos → Altseason. */}
      {onGoToAltseason && (
        <DeferUntilVisible minHeight={220} placeholder={<Skeleton className="h-[220px]" />}>
          <Suspense fallback={<Skeleton className="h-[220px]" />}>
            <AltseasonHomeCard onOpen={onGoToAltseason} />
          </Suspense>
        </DeferUntilVisible>
      )}

      {/* Temperatura del mercado, con su resumen; el desglose completo
          (bloques, confianza e histórico) sigue en su pestaña. */}
      {onGoToScore && (
        <DeferUntilVisible minHeight={300} placeholder={<Skeleton className="h-[300px]" />}>
          <Suspense fallback={<Skeleton className="h-[300px]" />}>
            <OportunidadHomeCard opportunity={data.opportunity} onOpen={onGoToScore} />
          </Suspense>
        </DeferUntilVisible>
      )}

      {/* Miedo y codicia en la barra líquida, al final; el detalle (histórico y
          mínimos) está en Análisis. */}
      {data.indicators.fearGreed != null && (
        <DeferUntilVisible minHeight={240} placeholder={<Skeleton className="h-[240px]" />}>
          <Suspense fallback={<Skeleton className="h-[240px]" />}>
            <MiedoCodiciaHomeCard
              valor={data.indicators.fearGreed}
              etiqueta={data.indicators.fearGreedLabel}
              onOpen={onGoToFearGreed}
            />
          </Suspense>
        </DeferUntilVisible>
      )}
    </div>
  );
}
