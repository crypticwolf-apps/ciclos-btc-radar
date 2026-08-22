import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cx } from '@/lib/format';

// =============================================================================
// Ayuda de una métrica: el icono «i» que explica qué se está mirando.
//
// Se dibuja FUERA de la tarjeta, en un portal pegado a <body>, y no dentro del
// hueco donde vive el icono. Es la única forma de que se vea: las tarjetas
// recortan lo que se sale de ellas (`overflow-hidden`, que es lo que les da las
// esquinas redondeadas), así que un globo colocado dentro se cortaba por arriba
// o desaparecía entero cuando el icono estaba en la primera línea del cuadro.
//
// Además:
//   · se abre al TOCAR, no solo al pasar el ratón: en un móvil no hay ratón que
//     pasar y la ayuda era inalcanzable;
//   · el globo se recoloca para no salirse por los lados de la pantalla, y baja
//     debajo del icono cuando arriba no cabe;
//   · al desplazar la página SIGUE al icono en vez de cerrarse. Cerrarlo era lo
//     primero que se intentó y quedaba inservible en el móvil: el desliz por
//     inercia sigue mandando eventos de scroll un buen rato después de soltar,
//     así que la ayuda se cerraba sola nada más abrirla;
//   · se cierra al tocar fuera, con Escape o si el icono sale de pantalla.
// =============================================================================

const WIDTH = 248;
const MARGIN = 10;
const GAP = 8;

interface InfoTooltipProps {
  text: string;
  children?: ReactNode;
  className?: string;
}

interface Position {
  left: number;
  top: number;
}

export function InfoTooltip({ text, children, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  // Se mide el globo YA dibujado (su alto depende del texto) y se coloca antes
  // de que el navegador pinte, para que no dé el salto de una posición a otra.
  useLayoutEffect(() => {
    if (!open) return setPosition(null);

    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      // Si el icono se ha ido de la pantalla, el globo ya no explica nada.
      if (trigger.bottom < 0 || trigger.top > window.innerHeight) return setOpen(false);

      const height = bubbleRef.current?.offsetHeight ?? 0;
      const below = trigger.top - height - GAP < MARGIN;
      const left = Math.min(
        Math.max(MARGIN, trigger.left + trigger.width / 2 - WIDTH / 2),
        window.innerWidth - WIDTH - MARGIN,
      );
      setPosition({ left, top: below ? trigger.bottom + GAP : trigger.top - height - GAP });
    };

    place();
    // Segunda pasada: la primera mide el globo aún sin alto definitivo.
    let raf = requestAnimationFrame(place);
    // Un recolocado por fotograma como mucho: el scroll dispara decenas de
    // eventos por segundo y medir en todos ellos hace saltar la página.
    let pendiente = false;
    const reposition = () => {
      if (pendiente) return;
      pendiente = true;
      raf = requestAnimationFrame(() => {
        pendiente = false;
        place();
      });
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    // `capture` para enterarse también del scroll de un contenedor interno.
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, text]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Qué significa"
        aria-expanded={open}
        className={cx('inline-flex shrink-0 items-center align-middle', className)}
        // El icono vive dentro de la cabecera plegable: sin esto, tocarlo
        // abriría o cerraría la tarjeta entera además de mostrar la ayuda.
        //
        // Abre con el clic y no con el foco: al tocar, el navegador enfoca
        // ANTES de disparar el clic, así que abrir al enfocar hacía que el
        // toque abriera y cerrara la ayuda en el mismo gesto.
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setOpen(false);
        }}
        onBlur={() => setOpen(false)}
      >
        {children ?? <Info size={14} className="text-muted transition-colors hover:text-btc" />}
      </button>

      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            role="tooltip"
            className={cx(
              'glass-strong pointer-events-none fixed z-[100] rounded-xl px-3 py-2 text-xs leading-relaxed text-secondary shadow-xl',
              position ? 'animate-scale-in' : 'invisible',
            )}
            style={{
              width: WIDTH,
              left: position?.left ?? 0,
              top: position?.top ?? 0,
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}
