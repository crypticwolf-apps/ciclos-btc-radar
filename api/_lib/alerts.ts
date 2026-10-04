import { createHash } from 'node:crypto';
import webpush from 'web-push';
import type { IncomingMessage } from 'node:http';
import { redis, sharedCacheConfig } from './cache.js';
import { readEnv } from './runtimeEnv.js';
import { phaseRule } from '../../src/lib/cycle/phaseRule.js';
import { CLASSIFICATIONS } from '../../src/lib/altseason/config.js';
import type { CyclePhaseId } from '../../src/types/index.js';
import type { DashboardResponse } from '../../src/types/dashboard.js';

// =============================================================================
// Alertas en el móvil (Web Push).
//
// Tres avisos, cada uno opcional por suscripción:
//   · fase      → cambia la fase del ciclo de Bitcoin;
//   · altseason → el Altseason Score cruza de tramo;
//   · miedo     → el Fear & Greed entra en miedo extremo o codicia extrema.
//
// Cómo funciona, sin cron obligatorio: cada vez que el servidor calcula de
// verdad /api/dashboard o /api/altseason, compara el estado de ahora con el
// último guardado en Redis y, si ha cambiado, avisa. Un cron diario de Vercel
// (vercel.json) hace la misma revisión por si nadie abre la app.
//
// Para no avisar de ruido:
//   · la fase nueva se confirma en dos revisiones separadas al menos una hora;
//   · el Altseason tiene un margen de 2 puntos alrededor de cada límite;
//   · el Fear & Greed entra en extremo a ≤20 / ≥80 y solo vuelve a «normal»
//     entre 26 y 74, así que un vaivén alrededor de 20 no manda diez avisos;
//   · un candado en Redis evita que dos instancias avisen a la vez.
//
// Todo vive en el Redis de la caché compartida, incluidas las claves VAPID,
// que se generan solas la primera vez. Sin Redis no hay alertas.
// =============================================================================

export type AlertKind = 'fase' | 'altseason' | 'miedo';
export type AlertPrefs = Record<AlertKind, boolean>;

interface StoredSub {
  subscription: webpush.PushSubscription;
  prefs: AlertPrefs;
  createdAt: string;
}

const K = {
  vapid: 'ciclos:push:vapid',
  subs: 'ciclos:push:subs',
  state: 'ciclos:alertas:estado',
  lock: (kind: string) => `ciclos:alertas:candado:${kind}`,
};
const MAX_SUBS = 5_000;
const HOUR = 60 * 60_000;
const SITE = 'https://ciclos.cryptoatalaya.com';

export function alertsConfigured(): boolean {
  return sharedCacheConfig() != null;
}

/**
 * ¿Lo lanza el cron de Vercel? Con CRON_SECRET definido, Vercel lo manda en la
 * cabecera y es la prueba buena. Sin él, al menos se exige la firma del cron
 * de Vercel: antes cualquiera podía lanzar la revisión completa a voluntad.
 */
export function cronAutorizado(req: Pick<IncomingMessage, 'headers'>, secret = readEnv('CRON_SECRET')): boolean {
  if (secret) return req.headers.authorization === `Bearer ${secret}`;
  return /^vercel-cron\//.test(String(req.headers['user-agent'] ?? ''));
}

// --- Claves VAPID -------------------------------------------------------------

let vapidCache: { publicKey: string; privateKey: string } | null = null;

/** Claves VAPID: se crean una vez y se guardan en Redis (SET NX: gana la primera). */
export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
  if (vapidCache) return vapidCache;
  if (!alertsConfigured()) return null;
  const read = async () => {
    const raw = await redis(['GET', K.vapid]);
    return typeof raw === 'string' ? (JSON.parse(raw) as { publicKey: string; privateKey: string }) : null;
  };
  let keys = await read();
  if (!keys) {
    await redis(['SET', K.vapid, JSON.stringify(webpush.generateVAPIDKeys()), 'NX']);
    keys = await read();
  }
  if (keys) vapidCache = keys;
  return keys;
}

// --- Suscripciones ------------------------------------------------------------

const idOf = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

export function parsePrefs(raw: unknown): AlertPrefs {
  const p = (raw ?? {}) as Partial<Record<AlertKind, unknown>>;
  return { fase: p.fase !== false, altseason: p.altseason !== false, miedo: p.miedo !== false };
}

/**
 * Servicios de avisos de los navegadores: Chrome/Edge/Android (Google), Safari
 * (Apple), Firefox (Mozilla) y Windows. Una suscripción que apunte a otro sitio
 * no viene de un navegador: aceptarla haría que este servidor enviara
 * peticiones a la dirección que alguien quisiera.
 */
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

export function isPushHost(hostname: string): boolean {
  return PUSH_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

/** Valida lo que manda el navegador: https, un servicio de avisos real y las dos claves de Web Push. */
export function parseSubscription(raw: unknown): webpush.PushSubscription | null {
  const s = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1_000) return null;
  try {
    const url = new URL(s.endpoint);
    if (url.protocol !== 'https:' || !isPushHost(url.hostname)) return null;
  } catch {
    return null;
  }
  const { p256dh, auth } = s.keys ?? {};
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: s.endpoint, keys: { p256dh, auth } };
}

export async function saveSubscription(subscription: webpush.PushSubscription, prefs: AlertPrefs): Promise<boolean> {
  const count = await redis(['HLEN', K.subs]);
  const id = idOf(subscription.endpoint);
  const exists = (await redis(['HEXISTS', K.subs, id])) === 1;
  if (!exists && typeof count === 'number' && count >= MAX_SUBS) return false;
  const value: StoredSub = { subscription, prefs, createdAt: new Date().toISOString() };
  return (await redis(['HSET', K.subs, id, JSON.stringify(value)])) != null;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await redis(['HDEL', K.subs, idOf(endpoint)]);
}

async function allSubscriptions(): Promise<{ id: string; sub: StoredSub }[]> {
  const raw = await redis(['HGETALL', K.subs]);
  if (!Array.isArray(raw)) return [];
  const out: { id: string; sub: StoredSub }[] = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    try {
      out.push({ id: String(raw[i]), sub: JSON.parse(String(raw[i + 1])) as StoredSub });
    } catch {
      /* entrada corrupta: se ignora */
    }
  }
  return out;
}

// --- Envío --------------------------------------------------------------------

export interface PushMessage {
  title: string;
  body: string;
  /** Agrupa: un aviso nuevo del mismo tipo sustituye al anterior en el móvil. */
  tag: string;
  url: string;
}

async function sendOne(sub: webpush.PushSubscription, msg: PushMessage): Promise<'ok' | 'gone' | 'error'> {
  const keys = await vapidKeys();
  if (!keys) return 'error';
  try {
    await webpush.sendNotification(sub, JSON.stringify(msg), {
      vapidDetails: { subject: SITE, publicKey: keys.publicKey, privateKey: keys.privateKey },
      TTL: 12 * 60 * 60,
      timeout: 8_000,
    });
    return 'ok';
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410: el navegador anuló la suscripción (app desinstalada, permiso retirado).
    return status === 404 || status === 410 ? 'gone' : 'error';
  }
}

/** Manda un aviso a quien lo tenga activado. Devuelve cuántos se entregaron. */
export async function broadcast(kind: AlertKind, msg: PushMessage): Promise<number> {
  const subs = (await allSubscriptions()).filter((s) => s.sub.prefs?.[kind] !== false);
  let sent = 0;
  for (let i = 0; i < subs.length; i += 20) {
    const batch = subs.slice(i, i + 20);
    const results = await Promise.all(batch.map((s) => sendOne(s.sub.subscription, msg)));
    results.forEach((r, j) => {
      if (r === 'ok') sent += 1;
      if (r === 'gone') void redis(['HDEL', K.subs, batch[j]!.id]);
    });
  }
  return sent;
}

export async function sendTest(subscription: webpush.PushSubscription): Promise<boolean> {
  return (
    (await sendOne(subscription, {
      title: 'Ciclos BTC Radar',
      body: 'Las alertas funcionan. Te avisaremos cuando cambie la fase, el Altseason cruce de tramo o el miedo llegue a un extremo.',
      tag: 'prueba',
      url: '/',
    })) === 'ok'
  );
}

// --- Detección de cambios -----------------------------------------------------

interface AlertState {
  fase?: CyclePhaseId;
  /** Fase vista una vez, pendiente de confirmar. */
  faseCandidata?: { fase: CyclePhaseId; desde: number } | null;
  altTramo?: string;
  miedoZona?: 'miedo-extremo' | 'normal' | 'codicia-extrema';
}

async function readState(): Promise<AlertState> {
  const raw = await redis(['GET', K.state]);
  try {
    return typeof raw === 'string' ? (JSON.parse(raw) as AlertState) : {};
  } catch {
    return {};
  }
}

async function writeState(patch: Partial<AlertState>): Promise<void> {
  // Se relee justo antes de escribir para no pisar lo que haya guardado otro tipo.
  const state = { ...(await readState()), ...patch };
  await redis(['SET', K.state, JSON.stringify(state)]);
}

/** Candado de Redis: solo una instancia revisa cada tipo a la vez. */
async function withLock(kind: string, fn: () => Promise<void>): Promise<void> {
  const ok = await redis(['SET', K.lock(kind), '1', 'NX', 'PX', 60_000]);
  if (ok !== 'OK') return;
  try {
    await fn();
  } finally {
    await redis(['DEL', K.lock(kind)]);
  }
}

const NOMBRE_FASE: Record<CyclePhaseId, string> = {
  acumulacion: 'Acumulación',
  'expansion-temprana': 'Expansión temprana',
  'expansion-avanzada': 'Expansión avanzada',
  euforia: 'Euforia',
  correccion: 'Corrección',
  capitulacion: 'Capitulación',
  recuperacion: 'Recuperación',
};

/** Zona del Fear & Greed con histéresis: entrar en extremo cuesta más que salir. */
export function fearZone(value: number, prev: AlertState['miedoZona']): NonNullable<AlertState['miedoZona']> {
  if (value <= 20) return 'miedo-extremo';
  if (value >= 80) return 'codicia-extrema';
  if (prev === 'miedo-extremo' && value <= 25) return 'miedo-extremo';
  if (prev === 'codicia-extrema' && value >= 75) return 'codicia-extrema';
  return 'normal';
}

/** Tramos del Altseason Score: los mismos que enseña la app. */
const TRAMOS: readonly { max: number; label: string }[] = CLASSIFICATIONS;

/** Tramo con margen de 2 puntos: no se sale del anterior por rozar el límite. */
export function altBand(score: number, prev: string | undefined, labels = TRAMOS): string {
  const i = labels.findIndex((t) => score <= t.max);
  const now = labels[i === -1 ? labels.length - 1 : i]!.label;
  const p = labels.findIndex((t) => t.label === prev);
  if (p !== -1 && now !== prev) {
    const lo = p === 0 ? -Infinity : labels[p - 1]!.max;
    const hi = labels[p]!.max;
    if (score > lo - 2 && score <= hi + 2) return prev!;
  }
  return now;
}

let lastMarketCheck = 0;

/** Fase del ciclo y Fear & Greed, con los datos de /api/dashboard. Nunca lanza. */
export async function checkMarketAlerts(d: DashboardResponse, now = Date.now()): Promise<void> {
  if (!alertsConfigured() || now - lastMarketCheck < HOUR / 2 || !d.market.summary) return;
  lastMarketCheck = now;
  try {
    await withLock('mercado', async () => {
      const state = await readState();
      const patch: Partial<AlertState> = {};
      const s = d.market.summary!;

      // Fase: se calcula con las mismas reglas que la app.
      const { id: fase, motivo } = phaseRule({
        dd: s.fromAthPct == null ? null : Math.min(0, Number(s.fromAthPct.toFixed(1))),
        tendencia: d.market.indicators?.trend ?? null,
        rsi: d.market.indicators?.rsi14 ?? null,
        fearGreed: d.market.sentiment?.value ?? null,
      });
      if (!state.fase) {
        patch.fase = fase;
      } else if (fase === state.fase) {
        if (state.faseCandidata) patch.faseCandidata = null;
      } else if (state.faseCandidata?.fase === fase && now - state.faseCandidata.desde >= HOUR) {
        patch.fase = fase;
        patch.faseCandidata = null;
        await broadcast('fase', {
          title: `Fase del ciclo: ${NOMBRE_FASE[fase]}`,
          body: `Bitcoin pasa de ${NOMBRE_FASE[state.fase]} a ${NOMBRE_FASE[fase]}. ${motivo}`,
          tag: 'fase',
          url: '/?vista=ciclos',
        });
      } else if (state.faseCandidata?.fase !== fase) {
        patch.faseCandidata = { fase, desde: now };
      }

      // Fear & Greed.
      const fg = d.market.sentiment?.value;
      if (fg != null) {
        const zona = fearZone(fg, state.miedoZona);
        if (zona !== state.miedoZona) {
          patch.miedoZona = zona;
          if (state.miedoZona && zona !== 'normal') {
            await broadcast('miedo', {
              title: zona === 'miedo-extremo' ? `Miedo extremo: ${fg}` : `Codicia extrema: ${fg}`,
              body:
                zona === 'miedo-extremo'
                  ? 'El índice Fear & Greed entra en miedo extremo. Históricamente ha coincidido con zonas de oportunidad, no con techos.'
                  : 'El índice Fear & Greed entra en codicia extrema. Históricamente ha acompañado a fases calientes del ciclo.',
              tag: 'miedo',
              url: '/?vista=oportunidad',
            });
          }
        }
      }

      if (Object.keys(patch).length > 0) await writeState(patch);
    });
  } catch {
    /* las alertas nunca tumban una respuesta */
  }
}

let lastAltCheck = 0;

/** Altseason Score, con el resultado de /api/altseason. Nunca lanza. */
export async function checkAltseasonAlert(score: number | null, now = Date.now()): Promise<void> {
  if (!alertsConfigured() || score == null || now - lastAltCheck < HOUR / 2) return;
  lastAltCheck = now;
  try {
    await withLock('altseason', async () => {
      const state = await readState();
      const tramo = altBand(score, state.altTramo);
      if (tramo === state.altTramo) return;
      await writeState({ altTramo: tramo });
      if (!state.altTramo) return;
      const sube = TRAMOS.findIndex((t) => t.label === tramo) > TRAMOS.findIndex((t) => t.label === state.altTramo);
      await broadcast('altseason', {
        title: `Altseason: ${tramo}`,
        body: `El Altseason Score ${sube ? 'sube' : 'baja'} a ${score}/100 y pasa de «${state.altTramo}» a «${tramo}».`,
        tag: 'altseason',
        url: '/?vista=ciclos&sub=altseason',
      });
    });
  } catch {
    /* las alertas nunca tumban una respuesta */
  }
}

/** Para tests. */
export function resetAlertThrottle(): void {
  lastMarketCheck = 0;
  lastAltCheck = 0;
  vapidCache = null;
}
