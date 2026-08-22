import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from './Card';
import { InfoTooltip } from './InfoTooltip';
import { cx } from '@/lib/format';

// =============================================================================
// Tarjeta plegable: la forma ÚNICA de tener un cuadro que se abre y se cierra.
//
// Antes cada sección se montaba su propio `<details>` con su cabecera y su
// flecha, y quedaban cuatro variantes ligeramente distintas. Esta reúne el
// patrón: cabecera pulsable con título, subtítulo, ayuda opcional y un hueco a
// la derecha para lo que tenga que verse SIN abrir (la etiqueta de frescura,
// normalmente), más la flecha que gira.
//
// Detalles que importan:
//   · es un `<details>` nativo, así que funciona sin JavaScript, se puede
//     recorrer con el teclado y el buscador del navegador encuentra el texto
//     de dentro aunque esté cerrado;
//   · la cabecera mide 56 px de alto mínimo, el objetivo táctil cómodo;
//   · el estado vive en el componente para poder animar la flecha, pero el
//     abierto/cerrado real lo gobierna el propio elemento.
// =============================================================================

interface CollapsibleCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Texto del icono de ayuda, junto al título. */
  info?: string;
  /** Contenido visible con la tarjeta cerrada (frescura, contadores…). */
  badge?: ReactNode;
  /** Icono a la izquierda del título. */
  icon?: ReactNode;
  children: ReactNode;
  /** Abierta de inicio (lo normal: nadie tiene que abrir para ver sus datos). */
  defaultOpen?: boolean;
  /** Color del título; por defecto el naranja de la marca. */
  titleClassName?: string;
  className?: string;
}

export function CollapsibleCard({
  title,
  subtitle,
  info,
  badge,
  icon,
  children,
  defaultOpen = true,
  titleClassName = 'text-btc',
  className,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <Card className={cx('!p-0 overflow-hidden', className)}>
      <details open={defaultOpen} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary
          className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden sm:px-5"
          aria-controls={bodyId}
        >
          <span className="min-w-0 flex-1">
            <span
              className={cx(
                'flex items-center gap-1.5 text-base font-bold sm:text-lg',
                titleClassName,
              )}
            >
              {icon}
              {title}
              {info && <InfoTooltip text={info} />}
            </span>
            {subtitle && (
              <span className="mt-0.5 block text-xs leading-tight text-muted sm:text-sm">
                {subtitle}
              </span>
            )}
            {/* En móvil la etiqueta baja de línea: compitiendo con el título en
                la misma fila, lo partía en dos («Presión del / mercado»). */}
            {badge && <span className="mt-1.5 block sm:hidden">{badge}</span>}
          </span>
          {badge && <span className="hidden shrink-0 sm:block">{badge}</span>}
          <ChevronDown
            size={20}
            aria-hidden="true"
            className={cx(
              'shrink-0 text-btc transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </summary>
        <div id={bodyId} className="border-t border-white/10 px-4 py-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      </details>
    </Card>
  );
}
