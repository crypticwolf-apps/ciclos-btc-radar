import { beforeEach, describe, expect, it } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { rateLimit, rateLimitReset } from './rateLimit.js';
import { rateLimited } from './guard.js';

function req(url: string, ip = '1.2.3.4'): IncomingMessage {
  return { url, headers: { 'x-forwarded-for': ip }, socket: {} } as unknown as IncomingMessage;
}
function res(): ServerResponse & { status?: number } {
  const r = {
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    end() {},
    set statusCode(v: number) { (r as { status?: number }).status = v; },
  };
  return r as unknown as ServerResponse & { status?: number };
}

describe('límite de peticiones', () => {
  beforeEach(() => rateLimitReset());

  it('deja pasar hasta el límite y corta después', () => {
    for (let i = 0; i < 5; i++) expect(rateLimit('k', 5).ok).toBe(true);
    expect(rateLimit('k', 5).ok).toBe(false);
  });

  it('tres móviles en la misma IP con Análisis abierto no llegan al límite', () => {
    // Precios cada 5 s (12/min) por persona, durante un minuto.
    for (let i = 0; i < 36; i++) expect(rateLimited(req('/api/precios?s=ETH'), res())).toBe(false);
  });

  it('cuenta por ruta: agotar una no bloquea las demás', () => {
    for (let i = 0; i < 300; i++) rateLimited(req('/api/precios?s=ETH'), res());
    expect(rateLimited(req('/api/precios?s=SOL'), res())).toBe(true);
    expect(rateLimited(req('/api/dashboard'), res())).toBe(false);
    expect(rateLimited(req('/api/precios', '5.6.7.8'), res())).toBe(false);
  });
});
