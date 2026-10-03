import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

// =============================================================================
// Plugin de desarrollo: monta las funciones serverless de /api como middleware
// del dev server, para que `npm run dev` funcione igual que en Vercel sin
// necesitar `vercel dev`. Cada request /api/<x> carga ./api/<x>.ts.
// =============================================================================
function apiDevMiddleware(): Plugin {
  return {
    name: 'ciclos-btc:api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const name = pathname.slice('/api/'.length).replace(/[^a-zA-Z0-9/_-]/g, '');
        const file = path.resolve(__dirname, 'api', `${name}.ts`);
        if (!name || !fs.existsSync(file)) return next();
        try {
          const mod = await server.ssrLoadModule(file);
          await (mod.default as (req: unknown, res: unknown) => Promise<void>)(req, res);
        } catch (err) {
          server.config.logger.error(`[api] ${name}: ${String(err)}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, data: null, error: String(err) }));
        }
      });
    },
  };
}

// =============================================================================
// Origen público de la web en las etiquetas de vista previa (og:url, og:image).
//
// El HTML trae `__SITE_ORIGIN__` y nadie lo sustituía: al compartir el enlace,
// WhatsApp o Telegram pedían «__SITE_ORIGIN__/og.jpg» y la tarjeta salía sin
// imagen. Orden de preferencia:
//   1. SITE_ORIGIN, si se define a mano;
//   2. el dominio de producción del proyecto en Vercel, que Vercel expone al
//      compilar y que pasa a ser el dominio propio en cuanto se añade uno
//      (ciclos.cryptoatalaya.com): basta con volver a desplegar;
//   3. la dirección de Vercel de siempre.
// =============================================================================
function siteOrigin(env: Record<string, string>): string {
  const raw =
    env.SITE_ORIGIN ||
    process.env.SITE_ORIGIN ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    'ciclos-btc-radar.vercel.app';
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

function siteOriginPlugin(origin: string): Plugin {
  return {
    name: 'ciclos-btc:site-origin',
    transformIndexHtml: (html) => html.split('__SITE_ORIGIN__').join(origin),
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Cargamos .env (incluidas claves SIN prefijo VITE_) y las exponemos a
  // process.env SOLO en el proceso de Node (dev server / build), nunca al
  // bundle del navegador.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of [
    'FRED_API_KEY',
    'COINGECKO_API_KEY',
    'GLASSNODE_API_KEY',
    'DUNE_API_KEY',
    'DUNE_QUERY_ID',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ]) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }

  return {
    base: '/',
    plugins: [react(), apiDevMiddleware(), siteOriginPlugin(siteOrigin(env))],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      open: true,
    },
    build: {
      outDir: 'dist/client',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('recharts') || id.includes('d3-')) return 'recharts';
            if (id.includes('@tanstack/react-query')) return 'query';
            if (id.includes('react') || id.includes('scheduler')) return 'react';
            return undefined;
          },
        },
      },
    },
  };
});
