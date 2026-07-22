import type { CyclePhase } from '@/types';
import { cx } from '@/lib/format';

interface CyclePhaseBadgeProps {
  fase: CyclePhase;
  size?: 'sm' | 'md';
  showEmoji?: boolean;
}

export function CyclePhaseBadge({ fase, size = 'md', showEmoji = true }: CyclePhaseBadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold animate-scale-in',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      )}
      style={{
        background: `${fase.color}1f`,
        color: fase.color,
        border: `1px solid ${fase.color}55`,
      }}
    >
      {showEmoji && <span>{fase.emoji}</span>}
      {fase.nombre}
    </span>
  );
}
