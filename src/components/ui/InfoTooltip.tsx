import { useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cx } from '@/lib/format';

// Tooltip de ayuda al pasar el ratón / al enfocar. Explica una métrica.
interface InfoTooltipProps {
  text: string;
  children?: ReactNode;
  className?: string;
}

export function InfoTooltip({ text, children, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cx('relative inline-flex items-center', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children ?? <Info size={14} className="text-muted hover:text-btc transition-colors" />}
      {open && (
        <span
          role="tooltip"
          className="glass-strong absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg px-3 py-2 text-xs leading-relaxed text-secondary shadow-xl animate-scale-in"
        >
          {text}
        </span>
      )}
    </span>
  );
}
