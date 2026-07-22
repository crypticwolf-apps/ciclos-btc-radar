import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

// --- Toggle tipo switch ------------------------------------------------------
interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, className }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx('inline-flex items-center gap-2 text-sm font-medium text-secondary', className)}
    >
      {label && <span>{label}</span>}
      <span
        className={cx(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-btc' : 'bg-white/15',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  );
}

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
            'min-h-9 rounded-[10px] font-semibold transition-all',
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
