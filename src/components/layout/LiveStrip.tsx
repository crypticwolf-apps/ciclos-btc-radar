import { Activity, PieChart, BarChart3 } from 'lucide-react';
import type { GlobalStats } from '@/types';
import { cx, formatPercent, formatUsdCompact } from '@/lib/format';

// Franja de métricas globales del mercado cripto, en vivo (CoinGecko /global).
interface LiveStripProps {
  global: GlobalStats;
}

export function LiveStrip({ global }: LiveStripProps) {
  const up = global.marketCapChange24h >= 0;
  return (
    <div className="glass grid grid-cols-2 gap-1 rounded-[22px] p-1 sm:grid-cols-4 sm:rounded-3xl">
      <Item
        icon={<BarChart3 size={15} />}
        label="Cap. total cripto"
        value={formatUsdCompact(global.marketCap)}
        accent={
          <span className={cx('text-xs font-semibold', up ? 'text-bull' : 'text-bear')}>
            {formatPercent(global.marketCapChange24h)}
          </span>
        }
      />
      <Item icon={<Activity size={15} />} label="Volumen 24h" value={formatUsdCompact(global.volume24h)} />
      <Item
        icon={<PieChart size={15} />}
        label="Dominancia BTC"
        value={`${global.btcDominance}%`}
      />
      <Item
        icon={
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-bull" />
          </span>
        }
        label="Mercado"
        value="En vivo"
        valueClass="text-bull"
      />
    </div>
  );
}

function Item({
  icon,
  label,
  value,
  accent,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="liquid-strip-item flex min-w-0 items-center gap-2.5 rounded-2xl px-3 py-3 sm:px-4">
      <span className="text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{label}</p>
        <p className={cx('flex items-center gap-1.5 font-mono text-sm font-bold text-primary', valueClass)}>
          {value} {accent}
        </p>
      </div>
    </div>
  );
}
