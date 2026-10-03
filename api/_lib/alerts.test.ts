import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardResponse } from '../../src/types/dashboard.js';

const sent: { endpoint: string; msg: { title: string; tag: string } }[] = [];
let goneEndpoints = new Set<string>();
vi.mock('web-push', () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: 'PUB', privateKey: 'PRIV' }),
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      if (goneEndpoints.has(sub.endpoint)) throw Object.assign(new Error('gone'), { statusCode: 410 });
      sent.push({ endpoint: sub.endpoint, msg: JSON.parse(payload) });
    },
  },
}));

const { cacheClear } = await import('./cache.js');
const alerts = await import('./alerts.js');
const { parseSubscription } = alerts;
const { altBand, fearZone, checkMarketAlerts, checkAltseasonAlert, saveSubscription, parsePrefs, resetAlertThrottle, vapidKeys } = alerts;

const HOUR = 3_600_000;
const sub = (n: number) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: 'p', auth: 'a' } });
const mercado = (o: { dd: number; trend: string; rsi: number; fg: number }) =>
  ({
    market: {
      summary: { priceUsd: 60_000, fromAthPct: o.dd },
      indicators: { trend: o.trend, rsi14: o.rsi },
      sentiment: { value: o.fg },
    },
  }) as unknown as DashboardResponse;

describe('alertas · umbrales', () => {
  it('el Fear & Greed entra en extremo a 20 y no sale hasta pasar de 25', () => {
    expect(fearZone(22, 'normal')).toBe('normal');
    expect(fearZone(20, 'normal')).toBe('miedo-extremo');
    expect(fearZone(24, 'miedo-extremo')).toBe('miedo-extremo');
    expect(fearZone(27, 'miedo-extremo')).toBe('normal');
    expect(fearZone(81, 'normal')).toBe('codicia-extrema');
  });

  it('el Altseason no cambia de tramo por rozar el límite', () => {
    expect(altBand(41, undefined)).toBe('Mercado mixto');
    expect(altBand(41, 'Rotación inicial')).toBe('Rotación inicial');
    expect(altBand(43, 'Rotación inicial')).toBe('Mercado mixto');
    expect(altBand(39, 'Mercado mixto')).toBe('Mercado mixto');
    expect(altBand(37, 'Mercado mixto')).toBe('Rotación inicial');
  });
});

describe('alertas · detección y envío', () => {
  let kv: Map<string, string>;
  let hash: Map<string, string>;

  beforeEach(async () => {
    cacheClear();
    resetAlertThrottle();
    sent.length = 0;
    goneEndpoints = new Set();
    kv = new Map();
    hash = new Map();
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 't';
    vi.stubGlobal('fetch', async (_u: string, init: { body: string }) => {
      const c = JSON.parse(init.body) as string[];
      let result: unknown = null;
      switch (c[0]) {
        case 'GET': result = kv.get(c[1]!) ?? null; break;
        case 'SET':
          if (c.includes('NX') && kv.has(c[1]!)) result = null;
          else { kv.set(c[1]!, c[2]!); result = 'OK'; }
          break;
        case 'DEL': kv.delete(c[1]!); result = 1; break;
        case 'HSET': hash.set(c[2]!, c[3]!); result = 1; break;
        case 'HDEL': hash.delete(c[2]!); result = 1; break;
        case 'HLEN': result = hash.size; break;
        case 'HEXISTS': result = hash.has(c[2]!) ? 1 : 0; break;
        case 'HGETALL': result = [...hash].flat(); break;
      }
      return new Response(JSON.stringify({ result }));
    });
    await saveSubscription(sub(1), parsePrefs({}));
    await saveSubscription(sub(2), parsePrefs({ fase: false }));
  });
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.unstubAllGlobals();
  });

  it('las claves VAPID se crean una vez y se reutilizan', async () => {
    expect(await vapidKeys()).toEqual({ publicKey: 'PUB', privateKey: 'PRIV' });
    expect(kv.get('ciclos:push:vapid')).toContain('PUB');
  });

  it('la primera revisión solo guarda el estado, sin avisar', async () => {
    await checkMarketAlerts(mercado({ dd: -40, trend: 'bajista', rsi: 40, fg: 40 }), 10 * HOUR);
    expect(sent).toEqual([]);
  });

  it('un cambio de fase se confirma en dos revisiones antes de avisar', async () => {
    const t = 1_000 * HOUR;
    await checkMarketAlerts(mercado({ dd: -40, trend: 'bajista', rsi: 40, fg: 40 }), t);
    resetAlertThrottle();
    await checkMarketAlerts(mercado({ dd: -40, trend: 'alcista', rsi: 40, fg: 40 }), t + HOUR);
    expect(sent).toEqual([]); // candidata
    resetAlertThrottle();
    await checkMarketAlerts(mercado({ dd: -40, trend: 'alcista', rsi: 40, fg: 40 }), t + 2 * HOUR);
    // Solo a quien tiene activado el aviso de fase.
    expect(sent.map((s) => s.endpoint)).toEqual(['https://fcm.googleapis.com/fcm/send/1']);
    expect(sent[0]!.msg.title).toBe('Fase del ciclo: Recuperación');
  });

  it('el miedo extremo avisa a todos los que lo tienen activado y borra las suscripciones muertas', async () => {
    goneEndpoints.add('https://fcm.googleapis.com/fcm/send/2');
    await checkMarketAlerts(mercado({ dd: -40, trend: 'bajista', rsi: 40, fg: 40 }), 10 * HOUR);
    resetAlertThrottle();
    await checkMarketAlerts(mercado({ dd: -40, trend: 'bajista', rsi: 40, fg: 12 }), 11 * HOUR);
    expect(sent.map((s) => s.msg.tag)).toEqual(['miedo']);
    expect(hash.size).toBe(1);
  });

  it('el Altseason avisa al cambiar de tramo', async () => {
    await checkAltseasonAlert(30, 10 * HOUR);
    resetAlertThrottle();
    await checkAltseasonAlert(55, 11 * HOUR);
    expect(sent).toHaveLength(2);
    expect(sent[0]!.msg.title).toBe('Altseason: Mercado mixto');
  });
});

describe('alertas · suscripciones', () => {
  const keys = { p256dh: 'p', auth: 'a' };
  it('solo acepta servicios de avisos de navegador', () => {
    for (const ok of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://web.push.apple.com/QGx',
      'https://updates.push.services.mozilla.com/wpush/v2/x',
      'https://wns2-par02p.notify.windows.com/w/?token=x',
    ]) expect(parseSubscription({ endpoint: ok, keys })).not.toBeNull();
    for (const ko of [
      'https://atacante.example/recoger',
      'https://fcm.googleapis.com.atacante.example/x',
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://notpush.apple.com.evil.io/x',
    ]) expect(parseSubscription({ endpoint: ko, keys })).toBeNull();
  });
});

