import type { ReactNode } from 'react';
import { cx } from '@/lib/format';
import { InfoTooltip } from './InfoTooltip';

// Card base con glassmorphism.
interface CardProps {
  children: ReactNode;
  className?: string;
  /** Acento de color en el borde superior. */
  accent?: string;
}

export function Card({ children, className, accent }: CardProps) {
  return (
    <div
      className={cx(
        'glass liquid-card rounded-[22px] p-4 sm:rounded-3xl sm:p-6 animate-fade-in',
        className,
      )}
      style={accent ? { boxShadow: `inset 0 2px 0 0 ${accent}22` } : undefined}
    >
      {children}
    </div>
  );
}

// ChartCard: card con encabezado (título + subtítulo + acción) y, debajo del
// gráfico, una conclusión tipo insight.
interface ChartCardProps {
  title: string;
  subtitle?: string;
  info?: string;
  action?: ReactNode;
  children: ReactNode;
  conclusion?: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  info,
  action,
  children,
  conclusion,
  className,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-base font-bold text-btc sm:text-lg">
            {title}
            {info && <InfoTooltip text={info} />}
          </h3>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
      </div>
      {children}
      {conclusion && (
        <div className="mt-4 rounded-xl border-l-2 border-btc/60 bg-btc/5 px-4 py-3 text-sm text-secondary">
          {conclusion}
        </div>
      )}
    </Card>
  );
}
