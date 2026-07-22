import type { DataSource } from '@/types';
import { cx, timeAgo } from '@/lib/format';

// Indica si los datos son "en vivo" o "simulados" y cuándo se actualizaron.
interface DataFreshnessBadgeProps {
  source: DataSource;
  lastUpdated: Date | null;
  className?: string;
  compact?: boolean;
}

export function DataFreshnessBadge({ source, lastUpdated, className, compact = false }: DataFreshnessBadgeProps) {
  const live = source === 'live';
  const stale = source === 'stale';

  const label = live ? 'Datos en vivo' : stale ? 'Sin conexión' : 'Datos simulados';
  const title = live
    ? 'Datos obtenidos de APIs en vivo (CoinGecko, Fear & Greed).'
    : stale
      ? 'No se pudo conectar con las APIs. Mostrando datos simulados de respaldo.'
      : 'Datos simulados (mock). Activa VITE_LIVE_DATA=true para datos reales.';

  const tone = live
    ? 'border-bull/40 bg-bull/10 text-bull'
    : stale
      ? 'border-bear/40 bg-bear/10 text-bear'
      : 'border-btc/40 bg-btc/10 text-btc';
  const dot = live ? 'bg-bull' : stale ? 'bg-bear' : 'bg-btc';

  return (
    <span
      className={cx('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', tone, className)}
      title={title}
    >
      <span className="relative flex h-2 w-2">
        <span className={cx('absolute inline-flex h-full w-full rounded-full opacity-75', live ? 'animate-ping bg-bull' : dot)} />
        <span className={cx('relative inline-flex h-2 w-2 rounded-full', dot)} />
      </span>
      {compact ? (live ? 'En vivo' : stale ? 'Offline' : 'Demo') : label}
      {!compact && lastUpdated && <span className="text-muted">· {timeAgo(lastUpdated)}</span>}
    </span>
  );
}
