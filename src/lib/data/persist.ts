import type { QueryClient, QueryKey } from '@tanstack/react-query';

// =============================================================================
// Los últimos datos, guardados en el dispositivo.
//
// Al abrir la app se enseñan al instante los del último uso (panel, Altseason
// e histórico) mientras llegan los nuevos, y sin conexión se siguen viendo. Las
// etiquetas de frescura ya dicen de cuándo es cada dato, porque usan la hora
// en que el SERVIDOR los obtuvo, y la barra superior avisa de que son datos
// guardados mientras se actualizan.
//
// Solo se guardan estas tres consultas y como mucho una semana: lo demás (precio
// en vivo, libro de órdenes…) no tiene sentido enseñarlo viejo.
// =============================================================================

const STORAGE_KEY = 'ciclos-datos-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const PERSISTED: QueryKey[] = [['dashboard'], ['altseason'], ['historial']];

interface Saved {
  key: QueryKey;
  data: unknown;
  at: number;
}

const same = (a: QueryKey, b: QueryKey) => JSON.stringify(a) === JSON.stringify(b);

/** Carga lo guardado en la caché de consultas, con su hora real. */
export function restoreQueries(client: QueryClient, now = Date.now()): void {
  let saved: Saved[] = [];
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Saved[];
  } catch {
    return;
  }
  if (!Array.isArray(saved)) return;
  for (const s of saved) {
    if (!s || !PERSISTED.some((k) => same(k, s.key)) || !(now - s.at < MAX_AGE_MS)) continue;
    // `updatedAt` antiguo: la consulta se da por caducada y se vuelve a pedir
    // en cuanto se monta, pero mientras tanto hay algo que enseñar.
    client.setQueryData(s.key, s.data, { updatedAt: s.at });
  }
}

/** Guarda las consultas persistidas cada vez que una se actualiza bien. */
export function persistQueries(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    const out: Saved[] = [];
    for (const key of PERSISTED) {
      const state = client.getQueryState(key);
      if (state?.data !== undefined && state.dataUpdatedAt > 0) {
        out.push({ key, data: state.data, at: state.dataUpdatedAt });
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      // Sin espacio o almacenamiento bloqueado: se prueba sin el histórico,
      // que es lo más pesado, y si tampoco cabe se deja de guardar.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out.filter((s) => !same(s.key, ['historial']))));
      } catch {
        /* nada que hacer */
      }
    }
  };
  return client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (!PERSISTED.some((k) => same(k, event.query.queryKey))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 1_000);
  });
}
