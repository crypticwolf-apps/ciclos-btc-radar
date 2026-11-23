import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { CollapsibleCard } from './Collapsible';
import { FreshnessTag } from './FreshnessTag';

// =============================================================================
// Un cuadro cuyo dato no ha llegado: el MISMO para todos.
//
// Antes cada uno lo resolvía a su manera: unos cambiaban el título («Tablero
// macro no disponible»), otros dejaban de ser plegables, otros enseñaban un
// aviso genérico sin decir de qué era, y algunos desaparecían sin más. Ahora
// el cuadro conserva su título y su icono, lleva la etiqueta roja «No
// disponible» (como Presión del mercado o Apalancamiento), una frase corta y,
// si se puede volver a pedir, el botón Reintentar. Y se pliega como los demás.
// =============================================================================

export function CuadroNoDisponible({
  title,
  icon,
  titleClassName,
  fuente,
  children,
  nota,
  onRetry,
  id,
}: {
  title: string;
  icon?: ReactNode;
  titleClassName?: string;
  /** De dónde debía llegar el dato (la etiqueta lo dice al pasar por encima). */
  fuente: string;
  /** Qué falta, en una frase. */
  children: ReactNode;
  /** Detalle técnico del fallo, en pequeño. */
  nota?: string | null;
  onRetry?: () => void;
  id?: string;
}) {
  return (
    <CollapsibleCard
      id={id}
      title={title}
      icon={icon}
      titleClassName={titleClassName}
      badge={<FreshnessTag freshness="no-disponible" source={fuente} />}
    >
      <p className="text-sm leading-relaxed text-secondary">{children}</p>
      {nota && <p className="mt-2 text-xs text-muted">Detalle: {nota}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="liquid-action mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-secondary"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Reintentar
        </button>
      )}
    </CollapsibleCard>
  );
}
