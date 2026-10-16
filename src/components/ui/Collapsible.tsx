import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from './Card';
import { InfoTooltip } from './InfoTooltip';
import { cx } from '@/lib/format';
import { collapsiblePreference, subscribeCollapsibles } from '@/lib/collapseAll';

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
//   · se apunta al avisador de `collapseAll`, que es lo que permite al botón de
//     la barra superior plegarlas o desplegarlas todas de una vez;
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
  /** El `badge` solo con la tarjeta plegada: abierta, su contenido ya lo enseña. */
  badgeSoloCerrada?: boolean;
  /** Icono a la izquierda del título. */
  icon?: ReactNode;
  children: ReactNode;
  /** Abierta de inicio (lo normal: nadie tiene que abrir para ver sus datos). */
  defaultOpen?: boolean;
  /** Color del título; por defecto el naranja de la marca. */
  titleClassName?: string;
  className?: string;
  /** Para enlazar a la tarjeta desde otra pestaña (navegación con ancla). */
  id?: string;
}

export function CollapsibleCard({
  title,
  subtitle,
  info,
  badge,
  badgeSoloCerrada,
  icon,
  children,
  defaultOpen = true,
  titleClassName = 'text-btc',
  className,
  id,
}: CollapsibleCardProps) {
  // Se fija al montar y no cambia: si React reescribiera este atributo en cada
  // repintado, pisaría lo que el usuario acabara de abrir a mano.
  const [initialOpen] = useState(() => collapsiblePreference() ?? defaultOpen);
  const [open, setOpen] = useState(initialOpen);
  const bodyId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Cambiar el atributo dispara el evento `toggle` del propio <details>, así
  // que la flecha se entera sola: no hace falta tocar aquí el estado.
  const verBadge = badge != null && (!badgeSoloCerrada || !open);

  useEffect(() => subscribeCollapsibles((next) => {
    if (detailsRef.current) detailsRef.current.open = next;
  }), []);

  return (
    <Card id={id} className={cx('!p-0 overflow-hidden', id && 'scroll-mt-3 lg:scroll-mt-20', className)}>
      <details ref={detailsRef} open={initialOpen} onToggle={(e) => setOpen(e.currentTarget.open)}>
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
            {verBadge && <span className="mt-1.5 block sm:hidden">{badge}</span>}
          </span>
          {verBadge && <span className="hidden shrink-0 sm:block">{badge}</span>}
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
