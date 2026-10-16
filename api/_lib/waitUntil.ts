// =============================================================================
// Trabajo que sigue después de responder.
//
// En Vercel, una función puede quedar congelada en cuanto envía la respuesta:
// una carga que aún no ha terminado se perdería, y la siguiente visita volvería
// a esperarla. `waitUntil` le pide a Vercel que mantenga viva la función hasta
// que acabe, para que llene la caché.
//
// Es el mismo mecanismo que el paquete oficial `@vercel/functions` (el contexto
// de la petición que Vercel publica en este símbolo global), sin sus 25
// dependencias. Fuera de Vercel (desarrollo, tests) no hace nada: el proceso
// sigue vivo y la carga termina igual.
// =============================================================================

interface RequestContext {
  waitUntil?: (promise: Promise<unknown>) => void;
}

const CONTEXT = Symbol.for('@vercel/request-context');

export function waitUntil(promise: Promise<unknown>): void {
  const holder = (globalThis as Record<symbol, { get?: () => RequestContext | undefined } | undefined>)[CONTEXT];
  holder?.get?.()?.waitUntil?.(promise.catch(() => undefined));
}
