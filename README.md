# Ciclos BTC · Dashboard de ciclos de Bitcoin

Panel educativo **«¿Por qué las caídas son oportunidades?»**: analiza Bitcoin por
ciclos, halvings, caídas históricas, RSI, Fear & Greed, métricas on-chain y ciclo
económico, con **datos reales obtenidos vía un backend propio** y refresco
automático.

> ⚠️ Proyecto **educativo. No es consejo financiero.** No incluye recomendaciones de
> compra/venta. Los datos históricos no garantizan resultados futuros.

---

## 1. Proveedores de datos

Todas las llamadas a APIs externas ocurren **en el backend** (`/api/*`); el navegador
solo habla con nuestra API interna. Ninguna clave se expone al cliente.

| Bloque | Proveedor | Clave | Coste |
|---|---|---|---|
| Precio, market cap, volumen, histórico | **CoinGecko** + CoinPaprika/Kraken; Blockchain.com para MAX | opcional (demo) | gratis |
| Sentimiento (Fear & Greed) | **alternative.me** | no | gratis |
| On-chain básico (hashrate, dificultad, tx/día, direcciones, mempool, supply) | **Blockchain.com** | no | gratis |
| Altura de bloque / halving / comisiones | **mempool.space** | no | gratis |
| Macro (tipos, CPI, paro, treasuries, dólar, M2, S&P, VIX) | **FRED** | **sí** | gratis |
| On-chain premium (MVRV, SOPR, Puell, LTH/STH, ETF) | **Glassnode / Dune** | sí | de pago |
| Altura/red (alternativa) | **Nodo Bitcoin propio (RPC)** | sí | propio |

Las métricas premium aparecen como **tarjeta bloqueada** mientras no haya clave
configurada. Si una fuente falla, el módulo muestra **«Dato no disponible»** con la
hora del último dato válido: nunca se muestran ceros ni valores simulados como reales.

## 2. Métricas y definiciones

| Métrica | Definición |
|---|---|
| Precio BTC/USD·EUR | Precio spot de CoinGecko o CoinPaprika y variación 1h/24h/7d/30d/1a. |
| Market cap / Volumen 24h / Dominancia | Capitalización y volumen globales; % de dominancia de BTC. |
| ATH / distancia desde ATH | Máximo histórico y caída porcentual actual respecto a él. |
| RSI (14d) | Índice de fuerza relativa calculado sobre cierres diarios reales. |
| Fear & Greed | Índice de sentimiento 0–100 (alternative.me) + histórico y cambio vs ayer. |
| Hashrate / Dificultad | Potencia de minado (EH/s) y dificultad de la red. |
| Transacciones/día · Direcciones activas | Actividad on-chain (media móvil 7d). |
| Mempool · Supply | Tamaño de la mempool y BTC en circulación. |
| Halving | Altura de bloque real, bloques restantes y fecha estimada (≈10 min/bloque). |
| Comisiones | sat/vB recomendadas (rápida / 30 min / 1 h / económica). |
| Macro (FRED) | Cada serie muestra valor, **fecha real de observación** y frecuencia. |

## 3. Variables de entorno

Copia `.env.example` a `.env`. **Ninguna lleva prefijo `VITE_`** (todas son del
servidor). Ver el archivo para la lista completa. La única necesaria para datos macro
es `FRED_API_KEY`; el resto son opcionales y desbloquean módulos extra.

```
FRED_API_KEY=            # macro (gratis) — https://fredaccount.stlouisfed.org/apikeys
COINGECKO_API_KEY=       # opcional, sube el límite de peticiones
GLASSNODE_API_KEY=       # opcional (de pago) — on-chain premium
DUNE_API_KEY= / DUNE_QUERY_ID=
BITCOIN_RPC_URL= / _USER= / _PASSWORD=
UPSTASH_REDIS_REST_URL= / _TOKEN=   # cache compartida opcional
```

## 4. Ejecutar en local

```bash
npm install
npm run dev        # http://localhost:5173  (el dev server también sirve /api/*)
npm run lint       # type-check estricto (tsc)
npm run test       # tests unitarios (Vitest)
npm run build      # type-check + build de producción
```

El plugin de Vite (`vite.config.ts`) monta las funciones de `/api` como middleware en
desarrollo, así que **no necesitas `vercel dev`**: `npm run dev` ya expone el backend.

`iniciar-app.cmd` es solo un acceso directo para Windows: instala dependencias si faltan
y arranca ese servidor local. La aplicación no funciona abriendo `index.html` directamente
porque el navegador necesita tanto el bundle de React como las rutas privadas `/api/*`.
Una vez publicada, no hace falta ejecutar el lanzador: basta con abrir la URL desde cualquier
dispositivo.

## 5. Despliegue

La compilación genera dos salidas dentro de `dist/`:

- `client/`: interfaz estática optimizada y dividida por secciones.
- `server/index.js`: Worker que sirve `/api/*`, los recursos y el fallback de la SPA.

El proyecto incluye `.openai/hosting.json` para Sites y conserva compatibilidad local con
Vite. Configura `FRED_API_KEY` como secreto del entorno de producción; ninguna clave debe
llevar prefijo `VITE_` ni incluirse en el repositorio.

El resumen de mercado usa CoinGecko como fuente principal y CoinPaprika/Kraken como
respaldo. El rango MAX usa el histórico diario completo de Blockchain.com, preserva
primer/último punto y extremos, y reduce puntos únicamente para el renderizado.

La interfaz es una SPA con cinco vistas principales (`Inicio`, `Ciclos`, `Oportunidad`,
`Análisis` y `Ajustes`). El precio está integrado en Inicio; Ciclos, Oportunidad y los
indicadores de Análisis se abren desplegados y pueden plegarse individualmente. Mantiene
moneda y cachés al cambiar de vista, usa rutas estables por query string y deja el estado
de proveedores en el panel compacto **En vivo**.

## 6. Limitaciones de cada fuente

- **CoinGecko (gratis):** límite ~10–30 req/min; mitigado con cache de servidor y
  clave demo opcional. Si rechaza la petición, el servidor cambia a CoinPaprika.
- **CoinPaprika:** respaldo público para precio, capitalización, volumen, ATH y
  dominancia; se usa solo cuando CoinGecko no responde.
- **alternative.me:** el índice se publica ~1 vez al día.
- **Blockchain.com:** series **diarias** (no intradía); usamos media móvil 7d.
- **mempool.space:** altura/fees en tiempo casi real; la fecha del halving es una
  **estimación** (asume 10 min/bloque).
- **FRED:** periodicidad real por serie (diaria/semanal/**mensual**); se muestra la
  fecha de observación, nunca como dato intradía.
- **Glassnode/Dune:** de pago; sin clave, módulo bloqueado.
- **ETF spot:** sin API pública gratuita fiable → módulo bloqueado salvo proveedor
  premium.

## 7. Política de cache y frecuencia

Cache en servidor con **stale-while-revalidate** (in-memory; Upstash opcional) +
refetch en cliente con TanStack Query:

| Bloque | Cache servidor | Refetch cliente |
|---|---|---|
| Precio / global | 60 s | 60 s |
| Fear & Greed | 30 min | (con el bloque de mercado) |
| On-chain básico | 15 min | 15 min |
| Macro (FRED) | 6 h | 6 h |
| Histórico de gráficos | 1–6 h según rango | bajo demanda |
| Estado de fuentes | 30 s | 60 s |

Ante un fallo del proveedor se sirve el último dato válido marcado como **«retrasado»**;
si nunca hubo dato, **«no disponible»**. Cada respuesta incluye su estado de frescura,
fuente y hora (UTC interno, mostrado en **Europe/Madrid**).

---

## Arquitectura

```
api/                      backend serverless (Vercel/Node)
├─ dashboard|market|onchain|macro|health.ts   rutas
└─ _lib/
   ├─ http.ts             fetch con timeout + reintentos backoff exponencial
   ├─ cache.ts            stale-while-revalidate en memoria
   ├─ rateLimit.ts        límite por IP
   ├─ respond.ts          envelope normalizado + CORS + helpers
   ├─ guard.ts            rate-limit guard
   └─ providers/          coingecko, alternativeme, blockchain, mempool, fred (Zod)
src/
├─ hooks/                 useBitcoinMarketData, useOnchainMetrics, useMacroData,
│                         useFearGreed, useHealth (TanStack Query)
├─ lib/data/client.ts     cliente único de /api
├─ types/                 api, market, onchain, macro (contratos)
├─ components/views/      Inicio, Análisis, Ajustes y Aviso legal
└─ components/sections/   Precio, Ciclos, Oportunidad e indicadores analíticos
```

**Validación:** todas las respuestas externas se validan con **Zod** antes de
normalizarse. **TypeScript estricto** en todo el repo (`npm run lint`).

## Estado de la migración

✅ Backend (rutas + cache + rate-limit + reintentos + Zod), proveedores reales, plugin
de dev, capa de datos del front (hooks TanStack Query) y panel compacto **«En vivo»**.

✅ Toda la UI consume datos reales vía el backend (`useMarketData` → `/api/dashboard`):
precio, global, RSI, Fear & Greed, **macro FRED en vivo** y **halving por altura de
bloque real**.

✅ **Gráfico de precio** con selector de rango (1D–MAX), histórico completo desde 2010,
**USD/EUR**, badge de frescura y estados de carga/error/«dato no disponible».

✅ Navegación responsive de cinco vistas, menú inferior fijo solo en móvil, cabecera
normal, contenido reemplazable y tablas de halvings convertidas en tarjetas móviles.

✅ **Sección on-chain** (hashrate, dificultad, tx/día, direcciones, mempool, supply,
comisiones, halving) + **tarjetas premium bloqueadas** (MVRV, SOPR, Puell, LTH/STH, ETF)
que se desbloquean al añadir clave de Glassnode/Dune.

`.env.example`, tests y build verde.

