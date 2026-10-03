import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { persistQueries, restoreQueries } from './persist';

const store = new Map<string, string>();

describe('datos guardados en el dispositivo', () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('guarda el panel al actualizarse y lo recupera con su hora real', async () => {
    const a = new QueryClient();
    persistQueries(a);
    await a.fetchQuery({ queryKey: ['dashboard'], queryFn: async () => ({ precio: 1 }) });
    await a.fetchQuery({ queryKey: ['orderbook'], queryFn: async () => ({ x: 1 }) });
    vi.advanceTimersByTime(1_500);

    const guardado = JSON.parse(store.get('ciclos-datos-v1')!) as { key: unknown[] }[];
    // Solo lo que tiene sentido enseñar viejo; el libro de órdenes, no.
    expect(guardado.map((s) => s.key)).toEqual([['dashboard']]);

    const b = new QueryClient();
    restoreQueries(b);
    expect(b.getQueryData(['dashboard'])).toEqual({ precio: 1 });
    expect(b.getQueryState(['dashboard'])!.dataUpdatedAt).toBe(a.getQueryState(['dashboard'])!.dataUpdatedAt);
  });

  it('no recupera datos de más de una semana', () => {
    const viejo = Date.now() - 8 * 24 * 60 * 60_000;
    store.set('ciclos-datos-v1', JSON.stringify([{ key: ['dashboard'], data: { precio: 1 }, at: viejo }]));
    const c = new QueryClient();
    restoreQueries(c);
    expect(c.getQueryData(['dashboard'])).toBeUndefined();
  });

  it('un almacenamiento roto no impide arrancar', () => {
    store.set('ciclos-datos-v1', '{no es json');
    expect(() => restoreQueries(new QueryClient())).not.toThrow();
  });
});
