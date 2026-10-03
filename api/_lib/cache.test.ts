import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { swr, cacheClear } from './cache.js';

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

describe('swr · carga única', () => {
  beforeEach(() => cacheClear());

  it('peticiones simultáneas esperan a una sola llamada al proveedor', async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return 'x';
    };
    await Promise.all(Array.from({ length: 5 }, () => swr('uno', { ttlMs: 1000, staleMs: 0 }, loader)));
    expect(calls).toBe(1);
  });
});

describe('swr · caché compartida (Upstash)', () => {
  const MIN = 5 * 60_000;
  let redisStore: Map<string, string>;
  let commands: string[][];
  let down: boolean;

  beforeEach(() => {
    cacheClear();
    redisStore = new Map();
    commands = [];
    down = false;
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 't';
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      if (down) throw new Error('caído');
      const cmd = JSON.parse(init.body) as string[];
      commands.push(cmd);
      const result = cmd[0] === 'GET' ? (redisStore.get(cmd[1]!) ?? null) : (redisStore.set(cmd[1]!, cmd[2]!), 'OK');
      return new Response(JSON.stringify({ result }));
    });
  });
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.unstubAllGlobals();
  });

  it('otra instancia (memoria vacía) reutiliza el dato sin llamar al proveedor', async () => {
    let calls = 0;
    const loader = async () => ++calls;
    const a = await swr('fred', { ttlMs: MIN, staleMs: MIN }, loader);
    cacheClear(); // como si fuera otra instancia en frío
    const b = await swr('fred', { ttlMs: MIN, staleMs: MIN }, loader);
    expect(calls).toBe(1);
    expect(b.status).toBe('cached');
    // La hora es la de la consulta original, no la de la lectura.
    expect(b.storedAt).toBe(a.storedAt);
  });

  it('los datos de pocos segundos no pasan por Redis', async () => {
    await swr('precios', { ttlMs: 5_000, staleMs: 0 }, async () => 1);
    expect(commands).toEqual([]);
  });

  it('si Redis falla, responde igual con el proveedor', async () => {
    down = true;
    const r = await swr('fred2', { ttlMs: MIN, staleMs: MIN }, async () => 'ok');
    expect(r).toMatchObject({ value: 'ok', status: 'live' });
  });

  it('un dato caducado de Redis sirve de respaldo si el proveedor cae', async () => {
    const viejo = { value: 'anterior', storedAt: Date.now() - 2 * MIN, freshUntil: Date.now() - MIN, staleUntil: Date.now() + MIN };
    redisStore.set('ciclos:swr:fred3', JSON.stringify(viejo));
    const r = await swr('fred3', { ttlMs: MIN, staleMs: MIN }, async () => {
      throw new Error('FRED caído');
    });
    expect(r).toMatchObject({ value: 'anterior', status: 'stale', storedAt: viejo.storedAt });
  });
});
