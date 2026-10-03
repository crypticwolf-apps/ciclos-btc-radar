import { useCallback, useEffect, useState } from 'react';

/**
 * `true` mientras el elemento está en pantalla (o a 200 px). Sirve para pedir
 * datos en vivo solo mientras alguien los está viendo.
 *
 * Devuelve una ref de callback: si el elemento cambia (por ejemplo, del
 * esqueleto de carga a la tarjeta), se vuelve a observar el nuevo.
 */
export function useEnVista<T extends Element>() {
  const [el, setEl] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useCallback((node: T | null) => setEl(node), []);
  useEffect(() => {
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return setVisible(true);
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return [ref, visible] as const;
}
