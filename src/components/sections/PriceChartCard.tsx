import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePriceHistory } from '@/hooks/useBitcoinMarketData';
import type { ChartRange } from '@/types/market';
import { statusLabel, type SourceMeta } from '@/types/api';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/Controls';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cx, timeAgo } from '@/lib/format';
import { useCurrency } from '@/contexts/CurrencyContext';

// =============================================================================
// Gráfico de precio de Bitcoin con datos reales (CoinGecko vía backend),
// selector de rango temporal (1D–Máx). La moneda procede del control global.
// carga, error, "dato no disponible" y badge de frescura de la fuente.
// =============================================================================

const RANGES: { value: ChartRange; label: string }[] = [
  { value: '1', label: '1D' },
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '365', label: '1A' },
  { value: 'max', label: 'Máx' },
];

const STATUS_DOT: Record<string, string> = {
  live: 'bg-emerald-500',
  cached: 'bg-sky-500',
  stale: 'bg-amber-500',
  unavailable: 'bg-red-500',
  locked: 'bg-zinc-500',
};

function FreshnessBadge({ meta }: { meta: SourceMeta | undefined }) {
  if (!meta) return null;
  const ago = meta.fetchedAt ? ` · ${timeAgo(new Date(meta.fetchedAt))}` : '';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={`Fuente: ${meta.provider}`}>
      <span className={cx('h-2 w-2 rounded-full', STATUS_DOT[meta.status] ?? 'bg-zinc-500')} aria-hidden="true" />
      {statusLabel(meta.status)}
      {ago}
    </span>
  );
}

export function PriceChartCard() {
  const [range, setRange] = useState<ChartRange>('30');
  const { currency, formatDirect } = useCurrency();
  const query = usePriceHistory(range, currency);
  const points = query.data?.data?.points ?? [];
  const meta = query.data?.meta.sources[0];

  const fmtMoney = (n: number) => formatDirect(n);

  const fmtAxisX = (t: number) =>
    new Intl.DateTimeFormat(
      'es-ES',
      range === '1'
        ? { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }
        : { day: '2-digit', month: 'short', timeZone: 'Europe/Madrid' },
    ).format(new Date(t));

  const fmtFull = (t: number) =>
    new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: range === '1' ? 'short' : undefined,
      timeZone: 'Europe/Madrid',
    }).format(new Date(t));

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-lg font-bold text-btc">
            Precio de Bitcoin
            <InfoTooltip text="Precio histórico agregado de CoinGecko (vía backend). Sigue la moneda global y permite cambiar el rango temporal. La hora se muestra en horario de Madrid." />
          </h3>
          <FreshnessBadge meta={meta} />
        </div>
        <div className="w-full min-w-0 sm:w-auto">
          <div role="group" aria-label="Rango temporal" className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SegmentedControl<ChartRange> size="sm" value={range} onChange={setRange} options={RANGES} className="min-w-max" />
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-60 sm:h-72" />
      ) : query.isError ? (
        <ErrorState
          message={query.error?.message ?? 'No se pudo cargar el histórico de precios.'}
          onRetry={() => query.refetch()}
        />
      ) : points.length === 0 ? (
        <div className="flex h-60 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-muted sm:h-72">
          Dato no disponible{meta?.fetchedAt ? ` · último válido ${timeAgo(new Date(meta.fetchedAt))}` : ''}
        </div>
      ) : (
        <div className="h-60 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis
                dataKey="t"
                tickFormatter={fmtAxisX}
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickFormatter={(v) => formatDirect(Number(v), { compact: true })}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated, #1a1a1a)',
                  border: '1px solid var(--grid-line)',
                  borderRadius: 12,
                  fontSize: 13,
                }}
                labelFormatter={(t) => fmtFull(Number(t))}
                formatter={(v: number | string) => [fmtMoney(Number(v)), 'Precio']}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#priceGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Fuente: CoinGecko · {meta?.provider ?? 'coingecko'} · datos reales, no es consejo financiero.
      </p>
    </Card>
  );
}
