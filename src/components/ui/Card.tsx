import type { ReactNode } from 'react';
import { cx } from '@/lib/format';
import { CollapsibleCard } from './Collapsible';

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

// ChartCard: tarjeta plegable con encabezado (título + subtítulo + ayuda).
//
// La cabecera es la que se pulsa para abrir y cerrar. Los controles de la
// tarjeta (`action`: selectores de rango, cambios de escala…) van dentro del
// cuerpo, no en la cabecera, para que pulsarlos no cierre el cuadro.
//
// Ya no lleva «conclusión»: las lecturas e ideas viven todas juntas en
// Ajustes → Información, no repartidas bajo cada gráfico.
interface ChartCardProps {
  title: string;
  subtitle?: string;
  info?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Visible con la tarjeta cerrada (frescura, etiquetas de estado…). */
  badge?: ReactNode;
  defaultOpen?: boolean;
}

export function ChartCard({
  title,
  subtitle,
  info,
  action,
  children,
  className,
  badge,
  defaultOpen = true,
}: ChartCardProps) {
  return (
    <CollapsibleCard
      title={title}
      subtitle={subtitle}
      info={info}
      badge={badge}
      defaultOpen={defaultOpen}
      className={className}
    >
      {action && <div className="mb-4">{action}</div>}
      {children}
    </CollapsibleCard>
  );
}
