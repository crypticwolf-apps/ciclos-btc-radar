import { useCallback, useRef } from 'react';

// =============================================================================
// Animaciones en pausa fuera de pantalla.
//
// Las barras líquidas, el termómetro y la rueda llevan animaciones que no
// acaban nunca (ondas, burbujas, halos). Fuera de la vista no las ve nadie,
// pero el navegador las seguía calculando en cada fotograma. Con esta marca,
// un único observador para toda la app pone `data-fuera` en el elemento
// mientras no se ve, y index.css pausa sus animaciones; al volver, siguen.
// Bonus: el líquido que se llena al abrir espera a estar a la vista.
// =============================================================================

let observador: IntersectionObserver | null = null;

function observar(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  observador ??= new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) e.target.toggleAttribute('data-fuera', !e.isIntersecting);
    },
    // Un poco de margen: que ya esté en marcha al asomar.
    { rootMargin: '120px 0px' },
  );
  return observador;
}

/** `ref` para el elemento cuyas animaciones deben pausarse fuera de pantalla. */
export function usePausaFuera<T extends Element>() {
  const actual = useRef<T | null>(null);
  return useCallback((el: T | null) => {
    const io = observar();
    if (actual.current) io?.unobserve(actual.current);
    actual.current = el;
    if (el) io?.observe(el);
  }, []);
}
