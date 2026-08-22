import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

// --- Segmented control (pestañas pequeñas) -----------------------------------
interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      className={cx(
        'liquid-control inline-flex max-w-full rounded-xl p-1',
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cx(
            'min-h-11 rounded-[10px] font-semibold transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            value === opt.value
              ? 'liquid-control-active text-white'
              : 'text-muted hover:text-secondary',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
