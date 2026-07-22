import { Scale } from 'lucide-react';
import { useLiveSpot, useMarketPressure } from '@/hooks/useRealtime';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card } from '@/components/ui/Card';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { cx, formatNumberEs } from '@/lib/format';

// =============================================================================
// «Presión del mercado»: qué lado del libro de órdenes tiene más volumen
// apoyado cerca del precio, ahora mismo.
//
// Se presenta deliberadamente como una MEDIDA DE ESTADO, no como una señal de
// compra: el libro cambia en segundos y cualquiera puede retirar sus órdenes.
// =============================================================================

export function MarketPressureCard() {
  const { formatFromUsd } = useCurrency();
  const pressure = useMarketPressure();
  const spot = useLiveSpot();

  const data = pressure.data;
  const buyPct = data?.buyPct ?? 50;

  // El spread instantáneo llega por WebSocket; el del libro, por REST.
  const spread = spot.book?.spread ?? data?.spread ?? null;
  const spreadPct = spot.book?.spreadPct ?? data?.spreadPct ?? null;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-lg font-bold text-btc">
          <Scale size={19} aria-hidden="true" /> Presión del mercado
          <InfoTooltip text="Compara el volumen de órdenes de compra y de venta en los 20 mejores niveles del libro de Binance. Mide el equilibrio actual entre ambos lados; no predice el precio ni es una recomendación." />
        </h3>
        {data == null && pressure.error ? (
          <FreshnessTag freshness="no-disponible" source="Binance" />
        ) : (
          <FreshnessTag
            freshness={pressure.stale ? 'cache' : 'actualizado'}
            at={pressure.at}
            source="Binance · libro de órdenes"
          />
        )}
      </div>

      {data == null ? (
        <p className="text-sm text-muted">
          {pressure.error
            ? 'No se pudo leer el libro de órdenes.'
            : 'Leyendo el libro de órdenes…'}
        </p>
      ) : (
        <>
          {/* Barra compradores vs vendedores */}
          <div
            className="flex h-8 w-full overflow-hidden rounded-xl"
            role="img"
            aria-label={`Compradores ${data.buyPct}%, vendedores ${data.sellPct}%`}
          >
            {/* min-w-0 + shrink-0 en el ancho: sin ellos el texto interior
                impide que el segmento baje de su tamaño de contenido y se
                desborda en pantallas de 320 px. */}
            <div
              className="flex min-w-0 shrink-0 items-center justify-start overflow-hidden bg-bull/80 pl-2 text-xs font-bold text-white transition-[width] duration-500"
              style={{ width: `${buyPct}%` }}
            >
              {buyPct >= 25 && `${data.buyPct}%`}
            </div>
            <div
              className="flex min-w-0 shrink-0 items-center justify-end overflow-hidden bg-bear/80 pr-2 text-xs font-bold text-white transition-[width] duration-500"
              style={{ width: `${100 - buyPct}%` }}
            >
              {data.sellPct >= 25 && `${data.sellPct}%`}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span>Compra · {formatNumberEs(data.bidVolume, 1)} BTC</span>
            <span>{formatNumberEs(data.askVolume, 1)} BTC · Venta</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile
              label="Desequilibrio"
              value={`${data.imbalance > 0 ? '+' : ''}${(data.imbalance * 100).toFixed(1)}%`}
              tone={data.imbalance > 0.05 ? 'bull' : data.imbalance < -0.05 ? 'bear' : 'neutral'}
              hint={
                data.imbalance > 0.05
                  ? 'Más volumen del lado comprador'
                  : data.imbalance < -0.05
                    ? 'Más volumen del lado vendedor'
                    : 'Libro equilibrado'
              }
            />
            <Tile
              label="Horquilla"
              value={spread != null ? formatFromUsd(spread, { maximumFractionDigits: 2 }) : '—'}
              tone="neutral"
              hint={spreadPct != null ? `${spreadPct.toFixed(3)}% del precio` : undefined}
            />
            <Tile
              label="Mejor compra"
              value={spot.book ? formatFromUsd(spot.book.bidPrice) : '—'}
              tone="bull"
              hint={spot.book ? `Venta ${formatFromUsd(spot.book.askPrice)}` : undefined}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          <p className="mt-3 text-xs text-muted">
            Fuente: Binance (spot BTC/USDT) · profundidad 20 niveles, refresco cada 4 s. Es una
            foto del libro visible: no anticipa el precio.
          </p>
        </>
      )}
    </Card>
  );
}

function Tile({
  label,
  value,
  tone,
  hint,
  className,
}: {
  label: string;
  value: string;
  tone: 'bull' | 'bear' | 'neutral';
  hint?: string;
  className?: string;
}) {
  const color = tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : 'text-primary';
  return (
    <div className={cx('min-w-0 rounded-xl border border-white/10 bg-white/5 p-3', className)}>
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className={cx('truncate font-mono text-lg font-bold tabular-nums', color)}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[10px] leading-tight text-muted">{hint}</p>}
    </div>
  );
}
