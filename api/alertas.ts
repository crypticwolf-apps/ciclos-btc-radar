import type { IncomingMessage, ServerResponse } from 'node:http';
import { applyCors, errorMessage, nowUtc, parseQuery, sendError, sendOk } from './_lib/respond.js';
import { rateLimited } from './_lib/guard.js';
import {
  alertsConfigured,
  checkAltseasonAlert,
  checkMarketAlerts,
  cronAutorizado,
  parsePrefs,
  parseSubscription,
  removeSubscription,
  saveSubscription,
  sendTest,
  vapidKeys,
} from './_lib/alerts.js';
import { getMarketSummary } from './_lib/providers/coingecko.js';
import { getTechnicalIndicators } from './_lib/providers/technicals.js';
import { getFearGreed } from './_lib/providers/alternativeme.js';
import { getAltseason } from './_lib/providers/altseason.js';
import type { DashboardResponse } from '../src/types/dashboard.js';

// =============================================================================
// /api/alertas → alertas en el móvil (Web Push).
//
//   GET                    → si están disponibles y la clave pública VAPID.
//   GET  ?revisar=1        → revisión completa (la lanza el cron diario).
//   POST {accion, …}       → 'suscribir' (con preferencias), 'baja', 'prueba'.
//
// La lógica está en _lib/alerts.ts.
// =============================================================================

const MAX_BODY = 8 * 1024;

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error('Petición demasiado grande.');
    chunks.push(chunk as Buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  if (!parsed || typeof parsed !== 'object') throw new Error('Cuerpo no válido.');
  return parsed as Record<string, unknown>;
}

/** Revisión completa: la que hace el cron aunque nadie abra la app. */
async function revisar(): Promise<void> {
  const [summary, indicators, sentiment, alt] = await Promise.allSettled([
    getMarketSummary(),
    getTechnicalIndicators(),
    getFearGreed(),
    getAltseason(),
  ]);
  const val = <T>(r: PromiseSettledResult<{ data: T }>) => (r.status === 'fulfilled' ? r.value.data : null);
  await checkMarketAlerts({
    market: { summary: val(summary), indicators: val(indicators), sentiment: val(sentiment) },
  } as unknown as DashboardResponse);
  const a = val(alt) as { result?: { score?: number | null } } | null;
  await checkAltseasonAlert(a?.result?.score ?? null);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  applyCors(res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (rateLimited(req, res, 60)) return;

  try {
    if (req.method === 'GET') {
      if (parseQuery(req).get('revisar')) {
        if (!cronAutorizado(req)) {
          sendError(res, 401, 'No autorizado.');
          return;
        }
        await revisar();
        sendOk(res, { revisado: nowUtc() }, []);
        return;
      }
      const keys = alertsConfigured() ? await vapidKeys() : null;
      sendOk(res, { configured: keys != null, publicKey: keys?.publicKey ?? null }, [], 300);
      return;
    }

    if (req.method !== 'POST') {
      sendError(res, 405, 'Método no permitido.');
      return;
    }
    if (!alertsConfigured()) {
      sendError(res, 503, 'Las alertas no están activadas en el servidor.');
      return;
    }

    const body = await readBody(req);
    const subscription = parseSubscription(body.subscription);
    if (!subscription) {
      sendError(res, 400, 'Suscripción no válida.');
      return;
    }

    switch (body.accion) {
      case 'suscribir': {
        const ok = await saveSubscription(subscription, parsePrefs(body.prefs));
        if (!ok) {
          sendError(res, 503, 'No se ha podido guardar la suscripción. Inténtalo más tarde.');
          return;
        }
        sendOk(res, { suscrito: true }, []);
        return;
      }
      case 'baja':
        await removeSubscription(subscription.endpoint);
        sendOk(res, { suscrito: false }, []);
        return;
      case 'prueba':
        sendOk(res, { enviado: await sendTest(subscription) }, []);
        return;
      default:
        sendError(res, 400, 'Acción no válida.');
    }
  } catch (err) {
    sendError(res, 400, errorMessage(err));
  }
}
