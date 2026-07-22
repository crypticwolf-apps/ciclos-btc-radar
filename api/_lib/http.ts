// =============================================================================
// fetch del lado servidor con timeout (AbortController), reintentos con backoff
// exponencial + jitter, y errores tipados. Reintenta en fallos de red, 429 y
// 5xx; no reintenta en 4xx (salvo 429).
// =============================================================================

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  headers?: Record<string, string>;
  /** Nombre del proveedor para mensajes de error. */
  provider?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const { timeoutMs = 8000, retries = 2, baseDelayMs = 400, headers, provider } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) {
        if (isRetryable(res.status) && attempt < retries) {
          throw new UpstreamError(`HTTP ${res.status}`, res.status, provider);
        }
        throw new UpstreamError(`HTTP ${res.status} de ${provider ?? url}`, res.status, provider);
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      const status = err instanceof UpstreamError ? err.status : undefined;
      const retryable = status === undefined || isRetryable(status);
      if (attempt < retries && retryable) {
        // Backoff exponencial con jitter: 400ms, 800ms, 1600ms… ±20%.
        const delay = baseDelayMs * 2 ** attempt;
        const jitter = delay * (Math.random() * 0.4 - 0.2);
        await sleep(Math.round(delay + jitter));
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastErr instanceof UpstreamError) throw lastErr;
  throw new UpstreamError(
    `Fallo de red consultando ${provider ?? url}: ${String(lastErr)}`,
    undefined,
    provider,
  );
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError(`Respuesta no-JSON de ${opts.provider ?? url}`, undefined, opts.provider);
  }
}
