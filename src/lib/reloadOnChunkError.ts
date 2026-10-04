// =============================================================================
// Recarga automática cuando falta un trozo de la app tras publicar una versión.
//
// Cada pestaña (Ciclos, Análisis…) se descarga la primera vez que se abre, y en
// cada publicación esos ficheros cambian de nombre: los de la versión anterior
// dejan de existir. Con la app abierta desde antes, abrir una pestaña pedía un
// fichero que ya no estaba, la carga fallaba y la pantalla se quedaba en blanco.
// Ahora, ante ese fallo, se recarga la página UNA vez y se abre la versión
// nueva. Si vuelve a fallar en menos de un minuto no se insiste (sería un
// bucle): se enseña el aviso de error con su botón de recargar.
// =============================================================================

const KEY = 'ciclos-recarga-por-version';
const VENTANA_MS = 60_000;

/** ¿El error es de un fichero de la app que no se ha podido descargar? */
export function isChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk|Unable to preload CSS/i.test(
    msg,
  );
}

/** Recarga la página si no se ha hecho ya hace menos de un minuto. Devuelve si recarga. */
export function reloadOnce(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < VENTANA_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    // Sin almacenamiento no se puede evitar un bucle: mejor no recargar solo.
    return false;
  }
  window.location.reload();
  return true;
}
