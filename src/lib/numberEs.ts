// =============================================================================
// Cifras en formato español para textos: coma decimal y punto de miles.
//
// Sin dependencias y con imports relativos .js en quien lo use: lo comparten la
// app y el servidor (las explicaciones del Score y del Altseason se generan con
// las mismas funciones en los dos sitios). Antes esos textos usaban
// `toFixed`, que escribe con punto decimal: «+6.1%», «MVRV 1.85».
// =============================================================================

const cache = new Map<number, Intl.NumberFormat>();

/** `v` con exactamente `d` decimales, en español: dec(1234.5, 1) → «1.234,5». */
export function dec(v: number, d: number): string {
  let f = cache.get(d);
  if (!f) {
    // `useGrouping: 'always'` es ES2023; el `lib` del proyecto lo declara booleano.
    f = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
      useGrouping: 'always',
    } as unknown as Intl.NumberFormatOptions);
    cache.set(d, f);
  }
  return f.format(v);
}
