import altseason from '../api/altseason';
import dashboard from '../api/dashboard';
import health from '../api/health';
import macro from '../api/macro';
import market from '../api/market';
import network from '../api/network';
import onchain from '../api/onchain';
import { setRuntimeEnv } from '../api/_lib/runtimeEnv';

type ApiHandler = (req: NodeRequest, res: NodeResponse) => Promise<void>;

interface WorkerEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  [key: string]: unknown;
}

interface NodeRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  socket: { remoteAddress: string };
}

class NodeResponse {
  statusCode = 200;
  private readonly headers = new Headers();
  private finished = false;

  constructor(private readonly resolve: (response: Response) => void) {}

  setHeader(name: string, value: string | number | readonly string[]): void {
    this.headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
  }

  end(body?: string): void {
    if (this.finished) return;
    this.finished = true;
    this.resolve(new Response(body ?? null, { status: this.statusCode, headers: this.headers }));
  }
}

const routes: Record<string, ApiHandler> = {
  '/api/altseason': altseason as unknown as ApiHandler,
  '/api/dashboard': dashboard as unknown as ApiHandler,
  '/api/health': health as unknown as ApiHandler,
  '/api/macro': macro as unknown as ApiHandler,
  '/api/market': market as unknown as ApiHandler,
  '/api/network': network as unknown as ApiHandler,
  '/api/onchain': onchain as unknown as ApiHandler,
};

function runApi(handler: ApiHandler, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const nodeRequest: NodeRequest = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    socket: {
      remoteAddress:
        request.headers.get('cf-connecting-ip') ??
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        'unknown',
    },
  };

  return new Promise<Response>((resolve) => {
    const response = new NodeResponse(resolve);
    void handler(nodeRequest, response).catch((error: unknown) => {
      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          ok: false,
          data: null,
          meta: { generatedAt: new Date().toISOString(), sources: [] },
          error: error instanceof Error ? error.message : 'Error interno del servidor.',
        }),
      );
    });
  });
}

async function injectSiteOrigin(response: Response, requestUrl: string): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;
  const origin = new URL(requestUrl).origin;
  const body = (await response.text()).replaceAll('__SITE_ORIGIN__', origin);
  return new Response(body, { status: response.status, headers: response.headers });
}

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    setRuntimeEnv(env);
    const url = new URL(request.url);
    const handler = routes[url.pathname];

    if (handler) return runApi(handler, request);

    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404 || request.method !== 'GET') {
      return injectSiteOrigin(asset, request.url);
    }

    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    if (!acceptsHtml) return asset;

    const index = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    return injectSiteOrigin(index, request.url);
  },
};

export default worker;
