import { useEffect, useMemo, useRef, useState } from 'react';
import {
  subscribeSpot,
  subscribeFutures,
  type LiveBook,
  type LiveTicker,
  type Liquidation,
} from '@/services/realtime/binance';
import type { SocketStatus } from '@/services/realtime/socketHub';
import {
  fetchDerivatives,
  fetchMarketPressure,
  type DerivativesSnapshot,
  type MarketPressure,
} from '@/services/realtime/binanceRest';

// =============================================================================
// Hooks de tiempo real.
//
// Detalle importante de rendimiento: el stream de Binance emite varias veces por
// segundo. Renderizar en cada trama fundiría la batería de un móvil, así que los
// datos se acumulan en una `ref` y se vuelcan al estado con un intervalo fijo
// (`THROTTLE_MS`). El precio se ve fluido pero React solo re-renderiza 2 veces
// por segundo como mucho.
// =============================================================================

const THROTTLE_MS = 500;

/** Estado de un dato en tiempo real, para etiquetarlo con honestidad. */
export interface RealtimeState {
  status: SocketStatus;
  /** `true` solo si el socket está abierto y ha llegado algo. */
  isLive: boolean;
  /** Momento del último dato recibido (epoch ms), o null. */
  at: number | null;
}

export interface LiveSpot extends RealtimeState {
  ticker: LiveTicker | null;
  book: LiveBook | null;
  /** Dirección del último cambio de precio, para animar sin recalcular. */
  tick: 'up' | 'down' | 'flat';
}

/**
 * Precio y libro en vivo (una única conexión spot compartida por toda la app).
 */
export function useLiveSpot(): LiveSpot {
  const buffer = useRef<{ ticker: LiveTicker | null; book: LiveBook | null; status: SocketStatus }>(
    { ticker: null, book: null, status: 'inactivo' },
  );
  const dirty = useRef(false);
  const lastPrice = useRef<number | null>(null);

  const [snapshot, setSnapshot] = useState<{
    ticker: LiveTicker | null;
    book: LiveBook | null;
    status: SocketStatus;
    tick: 'up' | 'down' | 'flat';
  }>({ ticker: null, book: null, status: 'inactivo', tick: 'flat' });

  useEffect(() => {
    const unsubscribe = subscribeSpot((partial) => {
      if (partial.ticker !== undefined) buffer.current.ticker = partial.ticker;
      if (partial.book !== undefined) buffer.current.book = partial.book;
      if (partial.status !== undefined) buffer.current.status = partial.status;
      dirty.current = true;
    });

    const timer = setInterval(() => {
      if (!dirty.current) return;
      dirty.current = false;
      const { ticker, book, status } = buffer.current;
      const previous = lastPrice.current;
      const price = ticker?.priceUsd ?? null;
      const tick: 'up' | 'down' | 'flat' =
        previous == null || price == null || price === previous
          ? 'flat'
          : price > previous
            ? 'up'
            : 'down';
      if (price != null) lastPrice.current = price;
      setSnapshot({ ticker, book, status, tick });
    }, THROTTLE_MS);

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  return useMemo(
    () => ({
      ticker: snapshot.ticker,
      book: snapshot.book,
      status: snapshot.status,
      tick: snapshot.tick,
      isLive: snapshot.status === 'abierto' && snapshot.ticker != null,
      at: snapshot.ticker?.tradeAt ?? snapshot.book?.at ?? null,
    }),
    [snapshot],
  );
}

export interface LiveLiquidations extends RealtimeState {
  /** Últimas liquidaciones recibidas, de la más reciente a la más antigua. */
  liquidations: Liquidation[];
  /** Valor liquidado desde que se abrió el canal, separado por lado. */
  liquidatedLongsUsd: number;
  liquidatedShortsUsd: number;
  /** `true` si el canal está abierto pero aún no ha ocurrido ninguna. */
  waiting: boolean;
}

const MAX_LIQUIDATIONS = 25;

/**
 * Liquidaciones forzadas en directo. La conexión de futuros SOLO existe
 * mientras haya algún componente usando este hook.
 *
 * Ojo con la interpretación: que no lleguen liquidaciones NO es un error, es
 * un mercado tranquilo. Por eso se expone `waiting` aparte de `isLive`, para
 * que la interfaz distinga «sin conexión» de «sin liquidaciones todavía».
 */
export function useLiveLiquidations(enabled = true): LiveLiquidations {
  const [status, setStatus] = useState<SocketStatus>('inactivo');
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);

  useEffect(() => {
    if (!enabled) {
      setStatus('inactivo');
      return;
    }
    const unsubscribe = subscribeFutures((partial) => {
      if (partial.status !== undefined) setStatus(partial.status);
      if (partial.liquidation) {
        // Son eventos aislados: se aplican directamente y se recorta la lista
        // para que no crezca sin límite.
        setLiquidations((current) => [partial.liquidation!, ...current].slice(0, MAX_LIQUIDATIONS));
      }
    });
    return unsubscribe;
  }, [enabled]);

  const totals = useMemo(() => {
    let longs = 0;
    let shorts = 0;
    for (const liquidation of liquidations) {
      // Una venta forzada cierra posiciones LARGAS, y una compra forzada, cortas.
      if (liquidation.side === 'SELL') longs += liquidation.valueUsd;
      else shorts += liquidation.valueUsd;
    }
    return { longs, shorts };
  }, [liquidations]);

  return {
    liquidations,
    liquidatedLongsUsd: totals.longs,
    liquidatedShortsUsd: totals.shorts,
    status,
    isLive: status === 'abierto' && liquidations.length > 0,
    waiting: status === 'abierto' && liquidations.length === 0,
    at: liquidations[0]?.at ?? null,
  };
}

// --- Sondeo REST con pausa por visibilidad ----------------------------------

interface PollState<T> {
  data: T | null;
  error: string | null;
  /** `true` mientras el dato mostrado proviene de una consulta anterior fallida. */
  stale: boolean;
  at: number | null;
}

/**
 * Sondea un endpoint cada `intervalMs`, cancelando la petición anterior con
 * AbortController, pausando cuando la pestaña no está visible y aplicando
 * backoff con un tope de fallos consecutivos (cortacircuitos).
 *
 * Ante un error NO borra el último dato válido: lo marca como `stale`.
 */
function usePoll<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  enabled = true,
): PollState<T> {
  const [state, setState] = useState<PollState<T>>({
    data: null,
    error: null,
    stale: false,
    at: null,
  });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    let loadedOnce = false;

    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = setTimeout(run, delay);
    };

    const run = async () => {
      if (cancelled) return;
      // Los sondeos se pausan con la pestaña oculta, PERO la primera carga se
      // hace siempre: si no, una pestaña abierta en segundo plano se quedaría
      // con la tarjeta en «Cargando…» hasta que el usuario la enfocara.
      if (loadedOnce && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        schedule(intervalMs);
        return;
      }

      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);

      try {
        const data = await loaderRef.current(controller.signal);
        clearTimeout(timeout);
        if (cancelled) return;
        failures = 0;
        loadedOnce = true;
        setState({ data, error: null, stale: false, at: Date.now() });
        schedule(intervalMs);
      } catch (error) {
        clearTimeout(timeout);
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        failures += 1;
        setState((current) => ({
          data: current.data, // se conserva el último dato válido
          error: error instanceof Error ? error.message : 'Error de red',
          stale: current.data != null,
          at: current.at,
        }));
        if (failures >= 5) return; // cortacircuitos: se deja de insistir
        schedule(Math.min(intervalMs * 2 ** failures, 5 * 60_000));
      }
    };

    void run();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        failures = 0;
        if (timer) clearTimeout(timer);
        void run();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled]);

  return state;
}

/** Presión compradora/vendedora del libro de órdenes (refresco: 4 s). */
export function useMarketPressure(enabled = true): PollState<MarketPressure> {
  return usePoll(fetchMarketPressure, 4000, enabled);
}

/** Open interest, ratio long/short y taker buy/sell (refresco: 60 s). */
export function useDerivatives(enabled = true): PollState<DerivativesSnapshot> {
  return usePoll(fetchDerivatives, 60_000, enabled);
}
