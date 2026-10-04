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
//
// Y solo los de la MISMA versión de la app: tras publicar una nueva, los datos
// guardados por la anterior pueden tener otra forma, y enseñarlos rompía la
// pantalla hasta salir de ella. Esa primera vez se espera a los datos nuevos.
// =============================================================================

const STORAGE_KEY = 'ciclos-datos-v2';
const OLD_KEYS = ['ciclos-datos-v1'];
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const PERSISTED: QueryKey[] = [['dashboard'], ['altseason'], ['historial']];

interface Saved {
  key: QueryKey;
  data: unknown;
  at: number;
}

interface Stored {
  /** Versión de la app que lo guardó. */
  build: string;
  items: Saved[];
}

const same = (a: QueryKey, b: QueryKey) => JSON.stringify(a) === JSON.stringify(b);

/** Carga lo guardado en la caché de consultas, con su hora real. */
export function restoreQueries(client: QueryClient, build: string, now = Date.now()): void {
  let stored: Stored | null = null;
  try {
    for (const k of OLD_KEYS) localStorage.removeItem(k);
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Stored | null;
  } catch {
    return;
  }
  if (!stored || stored.build !== build || !Array.isArray(stored.items)) return;
  for (const s of stored.items) {
    if (!s || !PERSISTED.some((k) => same(k, s.key)) || !(now - s.at < MAX_AGE_MS)) continue;
    // `updatedAt` antiguo: la consulta se da por caducada y se vuelve a pedir
    // en cuanto se monta, pero mientras tanto hay algo que enseñar.
    client.setQueryData(s.key, s.data, { updatedAt: s.at });
  }
}

/** Guarda las consultas persistidas cada vez que una se actualiza bien. */
export function persistQueries(client: QueryClient, build: string): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    const out: Saved[] = [];
    for (const key of PERSISTED) {
      const state = client.getQueryState(key);
      if (state?.data !== undefined && state.dataUpdatedAt > 0) {
        out.push({ key, data: state.data, at: state.dataUpdatedAt });
      }
    }
    const write = (items: Saved[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ build, items } satisfies Stored));
    try {
      write(out);
    } catch {
      // Sin espacio o almacenamiento bloqueado: se prueba sin el histórico,
      // que es lo más pesado, y si tampoco cabe se deja de guardar.
      try {
        write(out.filter((s) => !same(s.key, ['historial'])));
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
