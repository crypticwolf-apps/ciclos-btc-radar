import { describe, expect, it } from 'vitest';
import { FALLO_CACHE_S, sendOk, type SourceMeta } from './respond.js';

function res() {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 0,
    body: '',
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    end(b?: string) {
      this.body = b ?? '';
    },
  };
}

const live: SourceMeta = { provider: 'a', status: 'live', fetchedAt: null };
const caida: SourceMeta = { provider: 'b', status: 'unavailable', fetchedAt: null, note: 'fallo' };

describe('sendOk · caché del CDN', () => {
  it('con todas las fuentes bien, la caché de la ruta', () => {
    const r = res();
    sendOk(r as never, { x: 1 }, [live], 3600);
    expect(r.headers['cache-control']).toBe('s-maxage=3600, stale-while-revalidate=14400');
  });

  it('con alguna fuente caída, una caché corta', () => {
    const r = res();
    sendOk(r as never, { x: 1 }, [live, caida], 3600);
    expect(r.headers['cache-control']).toBe(`s-maxage=${FALLO_CACHE_S}, stale-while-revalidate=${FALLO_CACHE_S * 4}`);
  });

  it('sin dato, una caché corta', () => {
    const r = res();
    sendOk(r as never, null, [], 900);
    expect(r.headers['cache-control']).toContain(`s-maxage=${FALLO_CACHE_S},`);
  });

  it('una caché ya más corta no se alarga', () => {
    const r = res();
    sendOk(r as never, { x: 1 }, [caida], 5);
    expect(r.headers['cache-control']).toContain('s-maxage=5,');
  });

  it('sin caché pedida, sin cabecera', () => {
    const r = res();
    sendOk(r as never, { x: 1 }, [caida]);
    expect(r.headers['cache-control']).toBeUndefined();
  });
});
