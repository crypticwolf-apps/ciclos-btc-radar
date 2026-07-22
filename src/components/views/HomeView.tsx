import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { MarketData } from '@/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useLiveSpot } from '@/hooks/useRealtime';
import { Card } from '@/components/ui/Card';
import { CyclePhaseBadge } from '@/components/ui/CyclePhaseBadge';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { cx, formatNumberEs, formatPercent } from '@/lib/format';

export function HomeView({ data, onGoToScore }: { data: MarketData; onGoToScore?: () => void }) {
  const { formatFromUsd } = useCurrency();
  const spot = useLiveSpot();

  // El precio del WebSocket manda cuando el canal está abierto; si no, se usa el
  // del backend (que ya es real, solo que con menos frecuencia).
  const precio = spot.isLive ? spot.ticker!.priceUsd : data.bitcoin.precio;
  const cambio24h = spot.isLive ? spot.ticker!.changePct24h : data.bitcoin.cambio24h;
  const up = cambio24h >= 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="liquid-hero !p-4 sm:!p-6" accent={data.fase.color}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CyclePhaseBadge fase={data.fase} />
          <span className="text-[11px] text-muted">Fase estimada del ciclo</span>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2.5">
          {/* aria-live desactivado a propósito: anunciar cada tick del precio
              haría inusable el lector de pantalla. */}
          <h1
            aria-live="off"
            className={cx(
              'font-mono text-[2rem] font-extrabold leading-none tracking-[-0.05em] tabular-nums transition-colors duration-300 sm:text-5xl',
              spot.tick === 'up'
                ? 'text-bull'
                : spot.tick === 'down'
                  ? 'text-bear'
                  : 'text-primary',
            )}
          >
            {formatFromUsd(precio)}
          </h1>
          <span className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold', up ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear')}>
            {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
            {formatPercent(cambio24h)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <FreshnessTag
            freshness={spot.isLive ? 'vivo' : 'actualizado'}
            at={spot.isLive ? null : data.bitcoin.actualizado}
            source={spot.isLive ? 'Binance (WebSocket)' : 'proveedor de mercado'}
          />
          {spot.isLive && spot.ticker && (
            <span className="text-[11px] text-muted">
              24 h: {formatFromUsd(spot.ticker.low24h)} – {formatFromUsd(spot.ticker.high24h)}
            </span>
          )}
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-secondary">
          <span className="font-semibold text-primary">{data.opportunity.etiqueta}.</span>{' '}
          {data.opportunity.resumen}
        </p>
        {/* El score NO se muestra aquí: aparece una sola vez, en su pestaña,
            junto al desglose que lo justifica. Esto es solo el acceso. */}
        <a
          href="?vista=oportunidad"
          onClick={(event) => {
            event.preventDefault();
            onGoToScore?.();
          }}
          className="liquid-action mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-secondary"
        >
          Ver termómetro de oportunidad
          <ArrowRight size={15} aria-hidden="true" />
        </a>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <MiniMetric label="Desde ATH" value={formatPercent(data.bitcoin.drawdownDesdeAth)} tone="text-bear" />
        <MiniMetric label="Miedo y codicia" value={String(data.indicators.fearGreed)} tone="text-btc" />
        <MiniMetric label="Días al halving" value={formatNumberEs(data.halvingInfo.diasHastaProximoHalving)} tone="text-macro" />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="glass liquid-card min-w-0 rounded-2xl p-2.5 text-center sm:p-4">
      <p className={cx('truncate font-mono text-base font-extrabold tabular-nums sm:text-xl', tone)}>{value}</p>
      <p className="mt-1 text-[9px] leading-tight text-muted min-[360px]:text-[10px] sm:text-xs">{label}</p>
    </div>
  );
}

