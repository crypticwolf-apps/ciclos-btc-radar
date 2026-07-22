import type { IncomingMessage, ServerResponse } from 'node:http';
import { preflight, sendOk, sendError, settle, errorMessage } from './_lib/respond';
import { rateLimited } from './_lib/guard';
import { getMacro } from './_lib/providers/fred';

// =============================================================================
// /api/macro → bloque macro (FRED). Sin FRED_API_KEY responde 'locked'.
// =============================================================================

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (preflight(req, res)) return;
  if (rateLimited(req, res)) return;

  try {
    const macro = await settle('fred', getMacro());
    sendOk(res, { macro: macro.data }, [macro.meta], 6 * 60 * 60);
  } catch (err) {
    sendError(res, 502, errorMessage(err));
  }
}
