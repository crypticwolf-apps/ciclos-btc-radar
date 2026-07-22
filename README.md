# Ciclos BTC Â· Dashboard de ciclos de Bitcoin

Panel educativo **Â«Â¿Por quÃ© las caÃ­das son oportunidades?Â»**: analiza Bitcoin por
ciclos, halvings, caÃ­das histÃ³ricas, RSI, Fear & Greed, mÃ©tricas on-chain y ciclo
econÃ³mico, con **datos reales obtenidos vÃ­a un backend propio** y refresco
automÃ¡tico.

> âš ï¸ Proyecto **educativo. No es consejo financiero.** No incluye recomendaciones de
> compra/venta. Los datos histÃ³ricos no garantizan resultados futuros.

---

## 1. Proveedores de datos

Todas las llamadas a APIs externas ocurren **en el backend** (`/api/*`); el navegador
solo habla con nuestra API interna. Ninguna clave se expone al cliente.

| Bloque | Proveedor | Clave | Coste |
|---|---|---|---|
| Precio, market cap, volumen, histÃ³rico | **CoinGecko** + CoinPaprika/Kraken; Blockchain.com para MAX | opcional (demo) | gratis |
| Sentimiento (Fear & Greed) | **alternative.me** | no | gratis |
| On-chain bÃ¡sico (hashrate, dificultad, tx/dÃ­a, direcciones, mempool, supply) | **Blockchain.com** | no | gratis |
| Altura de bloque / halving / comisiones | **mempool.space** | no | gratis |
| Macro (tipos, CPI, paro, treasuries, dÃ³lar, M2, S&P, VIX) | **FRED** | **sÃ­** | gratis |
| On-chain premium (MVRV, SOPR, Puell, LTH/STH, ETF) | **Glassnode / Dune** | sÃ­ | de pago |
| Altura/red (alternativa) | **Nodo Bitcoin propio (RPC)** | sÃ­ | propio |

Las mÃ©tricas premium aparecen como **tarjeta bloqueada** mientras no haya clave
configurada. Si una fuente falla, el mÃ³dulo muestra **Â«Dato no disponibleÂ»** con la
hora del Ãºltimo dato vÃ¡lido: nunca se muestran ceros ni valores simulados como reales.

## 2. MÃ©tricas y definiciones

| MÃ©trica | DefiniciÃ³n |
|---|---|
| Precio BTC/USDÂ·EUR | Precio spot de CoinGecko o CoinPaprika y variaciÃ³n 1h/24h/7d/30d/1a. |
| Market cap / Volumen 24h / Dominancia | CapitalizaciÃ³n y volumen globales; % de dominancia de BTC. |
| ATH / distancia desde ATH | MÃ¡ximo histÃ³rico y caÃ­da porcentual actual respecto a Ã©l. |
| RSI (14d) | Ãndice de fuerza relativa calculado sobre cierres diarios reales. |
| Fear & Greed | Ãndice de sentimiento 0â€“100 (alternative.me) + histÃ³rico y cambio vs ayer. |
| Hashrate / Dificultad | Potencia de minado (EH/s) y dificultad de la red. |
| Transacciones/dÃ­a Â· Direcciones activas | Actividad on-chain (media mÃ³vil 7d). |
| Mempool Â· Supply | TamaÃ±o de la mempool y BTC en circulaciÃ³n. |
| Halving | Altura de bloque real, bloques restantes y fecha estimada (â‰ˆ10 min/bloque). |
| Comisiones | sat/vB recomendadas (rÃ¡pida / 30 min / 1 h / econÃ³mica). |
| Macro (FRED) | Cada serie muestra valor, **fecha real de observaciÃ³n** y frecuencia. |

## 3. Variables de entorno

Copia `.env.example` a `.env`. **Ninguna lleva prefijo `VITE_`** (todas son del
servidor). Ver el archivo para la lista completa. La Ãºnica necesaria para datos macro
es `FRED_API_KEY`; el resto son opcionales y desbloquean mÃ³dulos extra.

```
FRED_API_KEY=            # macro (gratis) â€” https://fredaccount.stlouisfed.org/apikeys
COINGECKO_API_KEY=       # opcional, sube el lÃ­mite de peticiones
GLASSNODE_API_KEY=       # opcional (de pago) â€” on-chain premium
DUNE_API_KEY= / DUNE_QUERY_ID=
BITCOIN_RPC_URL= / _USER= / _PASSWORD=
UPSTASH_REDIS_REST_URL= / _TOKEN=   # cache compartida opcional
```

## 4. Ejecutar en local

```bash
npm install
npm run dev        # http://localhost:5173  (el dev server tambiÃ©n sirve /api/*)
npm run lint       # type-check estricto (tsc)
npm run test       # tests unitarios (Vitest)
npm run build      # type-check + build de producciÃ³n
```

El plugin de Vite (`vite.config.ts`) monta las funciones de `/api` como middleware en
desarrollo, asÃ­ que **no necesitas `vercel dev`**: `npm run dev` ya expone el backend.

`iniciar-app.cmd` es solo un acceso directo para Windows: instala dependencias si faltan
y arranca ese servidor local. La aplicaciÃ³n no funciona abriendo `index.html` directamente
porque el navegador necesita tanto el bundle de React como las rutas privadas `/api/*`.
Una vez publicada, no hace falta ejecutar el lanzador: basta con abrir la URL desde cualquier
dispositivo.

## 5. Despliegue

La compilaciÃ³n genera dos salidas dentro de `dist/`:

- `client/`: interfaz estÃ¡tica optimizada y dividida por secciones.
- `server/index.js`: Worker que sirve `/api/*`, los recursos y el fallback de la SPA.

El proyecto incluye `.openai/hosting.json` para Sites y conserva compatibilidad local con
Vite. Configura `FRED_API_KEY` como secreto del entorno de producciÃ³n; ninguna clave debe
llevar prefijo `VITE_` ni incluirse en el repositorio.

El resumen de mercado usa CoinGecko como fuente principal y CoinPaprika/Kraken como
respaldo. El rango MAX usa el histÃ³rico diario completo de Blockchain.com, preserva
primer/Ãºltimo punto y extremos, y reduce puntos Ãºnicamente para el renderizado.

La interfaz es una SPA con cinco vistas principales (`Inicio`, `Precio`, `Ciclos`,
`Oportunidad` y `MÃ¡s`). Mantiene moneda y cachÃ©s al cambiar de vista, usa rutas estables
por query string y deja el estado de proveedores en el panel compacto **En vivo**.

## 6. Limitaciones de cada fuente

- **CoinGecko (gratis):** lÃ­mite ~10â€“30 req/min; mitigado con cache de servidor y
  clave demo opcional. Si rechaza la peticiÃ³n, el servidor cambia a CoinPaprika.
- **CoinPaprika:** respaldo pÃºblico para precio, capitalizaciÃ³n, volumen, ATH y
  dominancia; se usa solo cuando CoinGecko no responde.
- **alternative.me:** el Ã­ndice se publica ~1 vez al dÃ­a.
- **Blockchain.com:** series **diarias** (no intradÃ­a); usamos media mÃ³vil 7d.
- **mempool.space:** altura/fees en tiempo casi real; la fecha del halving es una
  **estimaciÃ³n** (asume 10 min/bloque).
- **FRED:** periodicidad real por serie (diaria/semanal/**mensual**); se muestra la
  fecha de observaciÃ³n, nunca como dato intradÃ­a.
- **Glassnode/Dune:** de pago; sin clave, mÃ³dulo bloqueado.
- **ETF spot:** sin API pÃºblica gratuita fiable â†’ mÃ³dulo bloqueado salvo proveedor
  premium.

## 7. PolÃ­tica de cache y frecuencia

Cache en servidor con **stale-while-revalidate** (in-memory; Upstash opcional) +
refetch en cliente con TanStack Query:

| Bloque | Cache servidor | Refetch cliente |
|---|---|---|
| Precio / global | 60 s | 60 s |
| Fear & Greed | 30 min | (con el bloque de mercado) |
| On-chain bÃ¡sico | 15 min | 15 min |
| Macro (FRED) | 6 h | 6 h |
| HistÃ³rico de grÃ¡ficos | 1â€“6 h segÃºn rango | bajo demanda |
| Estado de fuentes | 30 s | 60 s |

Ante un fallo del proveedor se sirve el Ãºltimo dato vÃ¡lido marcado como **Â«retrasadoÂ»**;
si nunca hubo dato, **Â«no disponibleÂ»**. Cada respuesta incluye su estado de frescura,
fuente y hora (UTC interno, mostrado en **Europe/Madrid**).

---

## Arquitectura

```
api/                      backend serverless (Vercel/Node)
â”œâ”€ dashboard|market|onchain|macro|health.ts   rutas
â””â”€ _lib/
   â”œâ”€ http.ts             fetch con timeout + reintentos backoff exponencial
   â”œâ”€ cache.ts            stale-while-revalidate en memoria
   â”œâ”€ rateLimit.ts        lÃ­mite por IP
   â”œâ”€ respond.ts          envelope normalizado + CORS + helpers
   â”œâ”€ guard.ts            rate-limit guard
   â””â”€ providers/          coingecko, alternativeme, blockchain, mempool, fred (Zod)
src/
â”œâ”€ hooks/                 useBitcoinMarketData, useOnchainMetrics, useMacroData,
â”‚                         useFearGreed, useHealth (TanStack Query)
â”œâ”€ lib/data/client.ts     cliente Ãºnico de /api
â”œâ”€ types/                 api, market, onchain, macro (contratos)
â”œâ”€ components/views/      Inicio, MÃ¡s, Ajustes y Aviso legal
â””â”€ components/sections/   Precio, Ciclos, Oportunidad e indicadores secundarios
```

**ValidaciÃ³n:** todas las respuestas externas se validan con **Zod** antes de
normalizarse. **TypeScript estricto** en todo el repo (`npm run lint`).

## Estado de la migraciÃ³n

âœ… Backend (rutas + cache + rate-limit + reintentos + Zod), proveedores reales, plugin
de dev, capa de datos del front (hooks TanStack Query) y panel compacto **Â«En vivoÂ»**.

âœ… Toda la UI consume datos reales vÃ­a el backend (`useMarketData` â†’ `/api/dashboard`):
precio, global, RSI, Fear & Greed, **macro FRED en vivo** y **halving por altura de
bloque real**.

âœ… **GrÃ¡fico de precio** con selector de rango (1Dâ€“MAX), histÃ³rico completo desde 2010,
**USD/EUR**, badge de frescura y estados de carga/error/Â«dato no disponibleÂ».

âœ… NavegaciÃ³n responsive de cinco vistas, menÃº inferior fijo solo en mÃ³vil, cabecera
normal, contenido reemplazable y tablas de halvings convertidas en tarjetas mÃ³viles.

âœ… **SecciÃ³n on-chain** (hashrate, dificultad, tx/dÃ­a, direcciones, mempool, supply,
comisiones, halving) + **tarjetas premium bloqueadas** (MVRV, SOPR, Puell, LTH/STH, ETF)
que se desbloquean al aÃ±adir clave de Glassnode/Dune.

`.env.example`, tests y build verde.
