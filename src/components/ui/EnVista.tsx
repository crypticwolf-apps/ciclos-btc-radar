import type { ReactNode } from 'react';
import { useEnVista } from '@/hooks/useEnVista';

/**
 * Le dice a un cuadro si está a la vista, para que pida datos en vivo solo
 * entonces. En la hoja de escritorio todo está montado a la vez y, sin esto, los
 * sondeos de lo que nadie mira seguirían corriendo.
 */
export function EnVista({ children }: { children: (visible: boolean) => ReactNode }) {
  const [ref, visible] = useEnVista<HTMLDivElement>();
  return <div ref={ref}>{children(visible)}</div>;
}
