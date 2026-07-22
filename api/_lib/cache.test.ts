import { describe, it, expect, beforeEach } from 'vitest';
import { swr, cacheClear } from './cache';

describe('swr (stale-while-revalidate)', () => {
  beforeEach(() => cacheClear());

  it('devuelve live en la primera llamada y cached en la segunda', async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return calls;
    };
    const a = await swr('k', { ttlMs: 1000, staleMs: 1000 }, loader);
    expect(a.status).toBe('live');
    expect(a.value).toBe(1);

    const b = await swr('k', { ttlMs: 1000, staleMs: 1000 }, loader);
    expect(b.status).toBe('cached');
    expect(b.value).toBe(1);
    expect(calls).toBe(1); // no se volvió a llamar al proveedor
  });

  it('sirve un dato stale si el proveedor falla tras caducar', async () => {
    let first = true;
    const loader = async () => {
      if (first) {
        first = false;
        return 'ok';
      }
      throw new Error('proveedor caído');
    };
    // ttl 0 → caduca inmediatamente; stale amplio → debe servir el último válido.
    await swr('k2', { ttlMs: 0, staleMs: 10_000 }, loader);
    const stale = await swr('k2', { ttlMs: 0, staleMs: 10_000 }, loader);
    expect(stale.status).toBe('stale');
    expect(stale.value).toBe('ok');
  });

  it('propaga el error si falla y no hay dato previo', async () => {
    await expect(
      swr('k3', { ttlMs: 0, staleMs: 0 }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
