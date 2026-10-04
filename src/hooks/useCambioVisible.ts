import { useEffect, useRef, useState } from 'react';

export type Direccion = 'up' | 'down' | 'flat';

/** Cuánto dura el color tras un cambio que se ve en pantalla. */
export const COLOR_MS = 1_500;

/**
 * Dirección de un cambio QUE SE VE. El precio llega con céntimos pero se
 * enseña redondeado: comparar el número crudo pintaba de verde o rojo
 * movimientos de céntimos con la cifra quieta, y el color saltaba de uno a
 * otro sin que el precio visible subiera ni bajara.
 *
 * Solo hay dirección si cambia el texto mostrado; si cambia el texto pero no
 * el valor (por ejemplo, al pasar de euros a dólares), no hay color.
 */
export function direccionVisible(
  anterior: { valor: number; texto: string } | null,
  valor: number,
  texto: string,
): Direccion | null {
  if (!anterior || anterior.texto === texto) return null; // nada nuevo a la vista
  if (valor > anterior.valor) return 'up';
  if (valor < anterior.valor) return 'down';
  return 'flat';
}

/**
 * Colorea un precio en vivo un momento cuando la cifra visible sube o baja, y
 * vuelve al color normal si no se mueve.
 */
export function useCambioVisible(valor: number, texto: string): Direccion {
  const anterior = useRef<{ valor: number; texto: string } | null>(null);
  // El temporizador va en una ref y no en la limpieza del efecto: el valor
  // cambia con cada céntimo, y esa limpieza lo cancelaría aunque la cifra
  // visible no se mueva, dejando el color puesto.
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [direccion, setDireccion] = useState<Direccion>('flat');

  useEffect(() => {
    const nueva = direccionVisible(anterior.current, valor, texto);
    if (anterior.current && nueva === null) return; // misma cifra: se deja como está
    anterior.current = { valor, texto };
    if (nueva === null) return;
    if (reset.current) clearTimeout(reset.current);
    setDireccion(nueva);
    reset.current = nueva === 'flat' ? null : setTimeout(() => setDireccion('flat'), COLOR_MS);
  }, [valor, texto]);

  useEffect(
    () => () => {
      if (reset.current) clearTimeout(reset.current);
    },
    [],
  );

  return direccion;
}
