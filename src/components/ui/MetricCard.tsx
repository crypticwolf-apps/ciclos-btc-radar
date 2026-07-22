import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/format';
import { InfoTooltip } from './InfoTooltip';

type Tone = 'btc' | 'bull' | 'bear' | 'macro' | 'neutral';

const TONE_TEXT: Record<Tone, string> = {
  btc: 'text-btc',
  bull: 'text-bull',
  bear: 'text-bear',
  macro: 'text-macro',
  neutral: 'text-secondary',
};

const TONE_BG: Record<Tone, string> = {
  btc: 'bg-btc/10 border-btc/25',
  bull: 'bg-bull/10 border-bull/25',
  bear: 'bg-bear/10 border-bear/25',
  macro: 'bg-macro/10 border-macro/25',
  neutral: 'bg-white/5 border-white/10',
};

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon?: LucideIcon;
  info?: string;
  pulse?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  sub,
  tone = 'neutral',
  icon: Icon,
  info,
  pulse,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cx(
        'liquid-subcard rounded-2xl border p-3.5 sm:p-4 animate-fade-in',
        TONE_BG[tone],
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-muted">
          {label}
          {info && <InfoTooltip text={info} />}
        </span>
        {Icon && <Icon size={16} className={TONE_TEXT[tone]} />}
      </div>
      <p
        className={cx(
          'font-mono text-2xl font-bold tabular-nums animate-count-up',
          TONE_TEXT[tone],
          pulse && 'animate-pulse',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
