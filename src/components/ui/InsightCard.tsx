import type { ReactNode } from 'react';
import { Lightbulb } from 'lucide-react';

// Tarjeta de "insight" con acento de color (RGB) para destacar conclusiones.
interface InsightCardProps {
  /** Color en formato "r,g,b" para construir fondos translúcidos. */
  rgb?: string;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}

export function InsightCard({ rgb = '245,158,11', title, children, icon }: InsightCardProps) {
  return (
    <div
      className="rounded-xl p-4 animate-fade-in"
      style={{
        background: `rgba(${rgb},0.08)`,
        border: `1px solid rgba(${rgb},0.28)`,
      }}
    >
      <p className="flex items-center gap-2 font-semibold" style={{ color: `rgb(${rgb})` }}>
        {icon ?? <Lightbulb size={16} />}
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-secondary">{children}</p>
    </div>
  );
}
