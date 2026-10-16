import { waitUntil } from './waitUntil.js';

// =============================================================================
// Tope de espera por fuente.
//
// Sin dato guardado (instancia recién arrancada y caché vacía), una fuente
// lenta hacía esperar a toda la respuesta. Con tope, la respuesta sale sin ella
// y la carga sigue por detrás (waitUntil) hasta llenar la caché, así que en la
// siguiente petición ya está. Lo que llega tarde se marca con `LateError`.
// =============================================================================

export class LateError extends Error {}

export function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  waitUntil(p);
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new LateError(`${label} tarda más de lo normal: llegará en la próxima actualización.`)),
      ms,
    );
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
