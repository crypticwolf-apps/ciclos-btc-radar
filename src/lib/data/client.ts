import type { Envelope } from '@/types/api';

// =============================================================================
// Cliente único de la API interna. Centraliza la llamada a /api/*, respeta el
// AbortSignal de React Query y normaliza errores. Ningún componente debe llamar
// a fetch directamente.
// =============================================================================

const BASE = import.meta.env.VITE_API_BASE ?? '';

export async function fetchEnvelope<T>(path: string, signal?: AbortSignal): Promise<Envelope<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      signal,
      headers: { accept: 'application/json' },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new Error('No se pudo contactar con el servidor de datos.');
  }

  if (!res.ok) {
    let message = `Error del servidor (HTTP ${res.status}).`;
    try {
      const body = (await res.json()) as Partial<Envelope<unknown>>;
      if (body?.error) message = body.error;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(message);
  }

  return (await res.json()) as Envelope<T>;
}
