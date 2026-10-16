import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { swr, cacheClear, REVALIDATE_WAIT_MS } from './cache.js';

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

describe('swr · no hacer esperar con un dato anterior a mano', () => {
  beforeEach(() => {
    cacheClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('si la recarga tarda, sirve el anterior y la recarga sigue por detrás', async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      if (calls === 1) return 'viejo';
      await new Promise((r) => setTimeout(r, 10_000)); // fuente lenta
      return 'nuevo';
    };
    const opts = { ttlMs: 5_000, staleMs: 60_000 };
    const a = await swr('lento', opts, loader);
    vi.advanceTimersByTime(6_000); // caduca

    const b = swr('lento', opts, loader);
    await vi.advanceTimersByTimeAsync(REVALIDATE_WAIT_MS);
    // No ha esperado los 10 s: el anterior, con su hora real.
    await expect(b).resolves.toMatchObject({ value: 'viejo', status: 'cached', storedAt: a.storedAt });

    // Mientras sigue la recarga, otra petición no lanza otra.
    const c = swr('lento', opts, loader);
    await vi.advanceTimersByTimeAsync(REVALIDATE_WAIT_MS);
    await expect(c).resolves.toMatchObject({ value: 'viejo' });
    expect(calls).toBe(2);

    // Al terminar, la caché ya tiene el nuevo.
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(swr('lento', opts, loader)).resolves.toMatchObject({ value: 'nuevo', status: 'cached' });
    expect(calls).toBe(2);
  });

  it('si la recarga es rápida, se espera y se sirve el dato nuevo', async () => {
    let n = 0;
    const loader = async () => {
      n += 1;
      await new Promise((r) => setTimeout(r, 200));
      return n;
    };
    const opts = { ttlMs: 1_000, staleMs: 60_000 };
    const first = swr('rapido', opts, loader);
    await vi.advanceTimersByTimeAsync(200);
    await first;
    vi.advanceTimersByTime(2_000);
    const b = swr('rapido', opts, loader);
    await vi.advanceTimersByTimeAsync(200);
    await expect(b).resolves.toMatchObject({ value: 2, status: 'live' });
  });
});
