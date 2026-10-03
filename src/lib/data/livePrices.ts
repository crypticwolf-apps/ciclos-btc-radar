// =============================================================================
// Precio al contado de las altcoins, UN solo sondeo para toda la app.
//
// Antes cada ficha (ranking de Altseason, categorías, marcador de inicio,
// comparativa) tenía su propio sondeo a /api/precios, y con varias a la vista
// salían varias peticiones cada 5 s con listas casi iguales. Ahora cada ficha
// se apunta con las monedas que necesita y aquí se piden todas juntas.
//
// Mismas reglas que el resto de sondeos (ver usePoll en hooks/useRealtime):
// cada 5 s, en pausa con la pestaña oculta (salvo la primera carga), tope de
// 10 s por petición, y ante un fallo se conserva el último dato marcado como
// `stale`, con reintentos cada vez más espaciados.
// =============================================================================

export interface LivePrices {
  prices: Record<string, number>;
  source: string;
  /** Hora de obtención en el servidor (epoch ms). */
  at: number;
}

export interface LivePricesState {
  data: LivePrices | null;
  error: string | null;
  /** `true` mientras se enseña el último dato bueno porque la renovación falla. */
  stale: boolean;
  at: number | null;
}

interface Sub {
  symbols: string[];
  exchange?: string;
  notify: (s: LivePricesState) => void;
}

export const INTERVAL_MS = 5_000;
const TIMEOUT_MS = 10_000;
const MAX_FAILURES = 5;

const subs = new Set<Sub>();
let state: LivePricesState = { data: null, error: null, stale: false, at: null };
let timer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
let failures = 0;
let loadedOnce = false;
/** Monedas de la última petición: si alguien se apunta con otras, se pide ya. */
let lastKey = '';

function publish(next: LivePricesState) {
  state = next;
  for (const s of subs) s.notify(state);
}

/** Todas las monedas pedidas y el exchange preferido (el primero que se pida). */
function request(): { key: string; exchange?: string } {
  const all = new Set<string>();
  let exchange: string | undefined;
  for (const s of subs) {
    for (const sym of s.symbols) all.add(sym);
    exchange ??= s.exchange;
  }
  return { key: [...all].sort().join(','), exchange };
}

function schedule(delay: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void run(), delay);
}

async function run(): Promise<void> {
  timer = null;
  if (subs.size === 0) return;
  if (loadedOnce && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    schedule(INTERVAL_MS);
    return;
  }
  const { key, exchange } = request();
  if (!key) return;
  lastKey = key;

  controller?.abort();
  const mine = (controller = new AbortController());
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    mine.abort();
  }, TIMEOUT_MS);

  try {
    const ex = exchange ? `&ex=${encodeURIComponent(exchange)}` : '';
    const response = await fetch(`/api/precios?s=${encodeURIComponent(key)}${ex}`, {
      signal: mine.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`La API respondió ${response.status}`);
    const envelope = (await response.json()) as {
      ok: boolean;
      data: { prices: Record<string, number>; source: string } | null;
      meta: { sources: { fetchedAt: string | null }[] };
      error?: string;
    };
    if (!envelope.ok || !envelope.data) throw new Error(envelope.error ?? 'Precios no disponibles');
    clearTimeout(timeout);
    if (mine !== controller) return; // ya hay otra petición más nueva
    // Hora de obtención en el servidor, no de llegada: el CDN puede servir la
    // misma respuesta unos segundos.
    const fetchedAt = Date.parse(envelope.meta.sources[0]?.fetchedAt ?? '');
    failures = 0;
    loadedOnce = true;
    publish({
      data: { ...envelope.data, at: Number.isFinite(fetchedAt) ? fetchedAt : Date.now() },
      error: null,
      stale: false,
      at: Date.now(),
    });
    schedule(INTERVAL_MS);
  } catch (error) {
    clearTimeout(timeout);
    if (mine !== controller) return;
    // Aborto que no es por tiempo: alguien pidió otra lista; esa petición manda.
    if (error instanceof DOMException && error.name === 'AbortError' && !timedOut) return;
    failures += 1;
    publish({
      data: state.data,
      error: error instanceof Error ? error.message : 'Error de red',
      stale: state.data != null,
      at: state.at,
    });
    if (failures >= MAX_FAILURES) return; // cortacircuitos: hasta volver a la pestaña
    schedule(Math.min(INTERVAL_MS * 2 ** failures, 5 * 60_000));
  }
}

function onVisible() {
  if (document.visibilityState === 'visible' && subs.size > 0) {
    failures = 0;
    void run();
  }
}

/**
 * Se apunta al sondeo con estas monedas. Devuelve la baja. Si pide monedas que
 * la última petición no llevaba, se pide enseguida en vez de esperar al turno.
 */
export function subscribeLivePrices(
  symbols: string[],
  exchange: string | undefined,
  notify: (s: LivePricesState) => void,
): () => void {
  const sub: Sub = { symbols, exchange, notify };
  const empty = subs.size === 0;
  subs.add(sub);
  if (empty && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
  notify(state);

  const covered = new Set(lastKey.split(','));
  const nuevas = symbols.some((s) => !covered.has(s));
  // Un instante de espera para juntar a las fichas que se montan a la vez.
  if (empty || nuevas) schedule(30);

  return () => {
    subs.delete(sub);
    if (subs.size === 0) {
      if (timer) clearTimeout(timer);
      timer = null;
      controller?.abort();
      controller = null;
      lastKey = '';
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

/** Para tests. */
export function resetLivePrices(): void {
  subs.clear();
  if (timer) clearTimeout(timer);
  timer = null;
  controller = null;
  state = { data: null, error: null, stale: false, at: null };
  failures = 0;
  loadedOnce = false;
  lastKey = '';
}
