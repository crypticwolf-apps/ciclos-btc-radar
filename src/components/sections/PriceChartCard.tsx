import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePriceHistory } from '@/hooks/useBitcoinMarketData';
import type { ChartRange, PricePoint } from '@/types/market';
import { statusLabel, type SourceMeta } from '@/types/api';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { cx, formatPercent, timeAgo } from '@/lib/format';
import { useCurrency } from '@/contexts/CurrencyContext';
import { downsamplePricePoints } from '@/lib/downsample';

const RANGES: { value: ChartRange; label: string }[] = [
  { value: '1', label: '1D' },
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '365', label: '1A' },
  { value: 'max', label: 'MÁX' },
];

const STATUS_DOT: Record<string, string> = {
  live: 'bg-emerald-500', cached: 'bg-sky-500', stale: 'bg-amber-500', unavailable: 'bg-red-500', locked: 'bg-zinc-500',
};

function FreshnessBadge({ meta }: { meta: SourceMeta | undefined }) {
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted" title={`Fuente: ${meta.provider}`}>
      <span className={cx('h-2 w-2 rounded-full', STATUS_DOT[meta.status] ?? 'bg-zinc-500')} />
      {statusLabel(meta.status)}{meta.fetchedAt ? ` · ${timeAgo(new Date(meta.fetchedAt))}` : ''}
    </span>
  );
}

export function PriceChartCard() {
  const [range, setRange] = useState<ChartRange>('30');
  const { currency, formatDirect } = useCurrency();
  const query = usePriceHistory(range, currency);
  const points = query.data?.data?.points ?? [];
  const renderPoints = useMemo(() => downsamplePricePoints(points, range === 'max' ? 900 : 1_200), [points, range]);
  const stats = useMemo(() => getStats(points), [points]);
  const meta = query.data?.meta.sources[0];

  const fmtAxisX = (timestamp: number) => new Intl.DateTimeFormat('es-ES', range === '1'
    ? { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }
    : range === 'max'
      ? { year: 'numeric', timeZone: 'Europe/Madrid' }
      : { day: '2-digit', month: 'short', timeZone: 'Europe/Madrid' },
  ).format(new Date(timestamp));

  const fmtFull = (timestamp: number) => new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium', timeStyle: range === '1' ? 'short' : undefined, timeZone: 'Europe/Madrid',
  }).format(new Date(timestamp));

  return (
    <Card className="!p-3 sm:!p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <div>
          <h1 className="text-lg font-extrabold text-primary sm:text-xl">Precio de Bitcoin</h1>
          <FreshnessBadge meta={meta} />
        </div>
        <span className="rounded-lg bg-btc/10 px-2 py-1 text-[10px] font-bold uppercase text-btc">{currency}</span>
      </div>

      <div role="group" aria-label="Rango temporal" className="liquid-control mt-3 grid grid-cols-6 gap-0.5 rounded-xl p-1">
        {RANGES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setRange(item.value)}
            aria-pressed={range === item.value}
            className={cx('min-h-10 min-w-0 rounded-[9px] px-0 text-[10px] font-bold min-[360px]:text-[11px]', range === item.value ? 'liquid-control-active text-white' : 'text-muted')}
          >
            {item.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <Skeleton className="mt-3 h-64 sm:h-80" />
      ) : query.isError ? (
        <div className="mt-3"><ErrorState message={query.error?.message ?? 'No se pudo cargar el histórico de precios.'} onRetry={() => query.refetch()} /></div>
      ) : points.length === 0 || !stats ? (
        <div className="mt-3 flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 text-center text-sm text-muted">Dato no disponible para este rango.</div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <PriceStat label="Actual" value={formatDirect(stats.last.price)} />
            <PriceStat label="Inicio" value={formatDirect(stats.first.price)} />
            <PriceStat label="Máximo" value={formatDirect(stats.high.price)} tone="text-bull" />
            <PriceStat label="Mínimo" value={formatDirect(stats.low.price)} tone="text-bear" />
          </div>

          <div className="mt-3 h-64 min-w-0 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={renderPoints} margin={{ top: 8, right: 2, left: 0, bottom: 2 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtAxisX} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} minTickGap={34} />
                <YAxis domain={['dataMin', 'dataMax']} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(value) => formatDirect(Number(value), { compact: true })} width={49} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(timestamp) => fmtFull(Number(timestamp))}
                  formatter={(value: number | string) => [formatDirect(Number(value)), 'Precio']}
                />
                <Area type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} fill="url(#priceGrad)" dot={false} isAnimationActive={range !== 'max'} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 px-1 text-[10px] text-muted sm:text-xs">
            <span>{fmtFull(stats.first.t)} → {fmtFull(stats.last.t)}</span>
            <span className={stats.change >= 0 ? 'text-bull' : 'text-bear'}>{formatPercent(stats.change)} en el periodo</span>
          </div>
        </>
      )}

      <p className="mt-3 px-1 text-[10px] text-muted sm:text-xs">
        Fuente: {meta?.provider ?? 'proveedor de mercado'}{range === 'max' && points.length > 0 ? ` · ${points.length.toLocaleString('es-ES')} cierres diarios; ${renderPoints.length.toLocaleString('es-ES')} puntos dibujados` : ''}
      </p>
    </Card>
  );
}

function getStats(points: PricePoint[]) {
  if (points.length === 0) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let high = first;
  let low = first;
  for (const point of points) {
    if (point.price > high.price) high = point;
    if (point.price < low.price) low = point;
  }
  return { first, last, high, low, change: ((last.price - first.price) / first.price) * 100 };
}

function PriceStat({ label, value, tone = 'text-primary' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="liquid-subcard min-w-0 rounded-xl px-2.5 py-2.5">
      <p className={cx('truncate font-mono text-sm font-extrabold tabular-nums sm:text-base', tone)}>{value}</p>
      <p className="mt-0.5 text-[10px] text-muted">{label}</p>
    </div>
  );
}
