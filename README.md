# Ciclos BTC · Dashboard de ciclos de Bitcoin

Panel educativo **«¿Por qué las caídas son oportunidades?»**: analiza Bitcoin por
ciclos, halvings, caídas históricas, RSI, Fear & Greed, métricas on-chain y ciclo
económico, con **datos reales obtenidos vía un backend propio** y refresco
automático.

> ⚠️ Proyecto **educativo. No es consejo financiero.** No incluye recomendaciones de
> compra/venta. Los datos históricos no garantizan resultados futuros.

---

## 1. Proveedores de datos

Casi todas las llamadas ocurren **en el backend** (`/api/*`), que cachea y protege
las cuotas. La excepción son los streams de Binance, que por definición tienen que
abrirse desde el navegador. Ninguna clave se expone al cliente.

| Dato | Proveedor | Frecuencia real | Etiqueta | Clave |
|---|---|---|---|---|
| Precio, variación, máx./mín. y volumen 24 h | **Binance** (WebSocket spot) | instantánea | En vivo | no |
| Presión compradora/vendedora (libro, 20 niveles) | **Binance** (REST) | 4 s | Actualizado | no |
| Funding, interés abierto, long/short, taker | **Binance Futures** (REST) | 60 s · ratios 1 h | Actualizado | no |
| Liquidaciones forzadas | **Binance Futures** (WebSocket) | por evento | En vivo | no |
| Precio de referencia, market cap, dominancia, histórico | **CoinGecko** + CoinPaprika/Kraken de respaldo | 60 s | Actualizado | opcional |
| Técnicos: RSI, medias 50/200 d y **200 semanas**, volatilidad, rendimientos | **Coin Metrics Community** (5.800 cierres desde 2010) | diaria | Diario | no |
| MVRV, NUPL, capitalización realizada, Puell Multiple | **Coin Metrics Community** | diaria | Diario | no |
| Hashrate, tx/día, direcciones activas, supply | **Coin Metrics Community** | diaria | Diario | no |
| Mempool, comisiones, hashrate, dificultad, último bloque | **mempool.space** | 1 min · hashrate 30 min | Actualizado | no |
| Liquidez en stablecoins (total, 7 d, 30 d, por emisor) | **DefiLlama** | diaria | Diario | no |
| Sentimiento (Fear & Greed) | **alternative.me** | diaria | Diario | no |
| Macro (tipos, CPI, paro, treasuries, dólar, M2, S&P, VIX) | **FRED** | según serie | Diario/mensual | **sí** |

**Regla de etiquetado.** La etiqueta describe la frecuencia REAL de la fuente, no lo
reciente que sea nuestra consulta: un índice que se publica una vez al día es
«Diario» aunque acabemos de pedirlo. Si una fuente falla se muestra el último dato
válido marcado como «En caché» o «Retrasado» con su antigüedad; si nunca hubo dato,
«No disponible». **Nunca se muestran ceros ni valores simulados como reales.**

### Qué se ha dejado fuera, y por qué

- **Realized cap y miner revenue directos, DiffMean, FeeTotUSD:** el plan
  *community* de Coin Metrics los devuelve con `403`. La capitalización realizada
  sí se publica porque se deriva por identidad exacta (`marketCap / MVRV`), igual
  que el NUPL (`1 − 1/MVRV`) y el Puell (`emisión / media 365 d`); eso es
  aritmética sobre datos servidos, no una estimación.
- **Flujos de ETF spot:** sin API pública gratuita y fiable. Antes había una
  serie simulada que además alimentaba el score; se ha retirado.
- **ISM:** idem. Se ha retirado del cálculo del score.
- **Balance real de ballenas frente a minoristas:** solo lo venden proveedores de
  pago. Lo que se muestra es un proxy de actividad on-chain, y se dice que lo es.

## 2. Métricas y definiciones

| Métrica | Definición |
|---|---|
| Precio BTC/USD·EUR | Precio spot de CoinGecko o CoinPaprika y variación 1h/24h/7d/30d/1a. |
| Market cap / Volumen 24h / Dominancia | Capitalización y volumen globales; % de dominancia de BTC. |
| ATH / distancia desde ATH | Máximo histórico y caída porcentual actual respecto a él. |
| RSI (14d) | Índice de fuerza relativa calculado sobre cierres diarios reales. |
| Fear & Greed | Índice de sentimiento 0–100 (alternative.me) + histórico y cambio vs ayer. |
| Hashrate / Dificultad | Potencia de minado (EH/s), dificultad y **próximo reajuste** estimado. |
| MVRV / NUPL / Realized cap | Valoración del ciclo: mercado frente a coste agregado de las monedas. |
| Puell Multiple | Emisión diaria en USD frente a su media de 365 días. |
| Presión del mercado | Volumen de compra frente a venta en los 20 mejores niveles del libro. |
| Apalancamiento | Funding, interés abierto y su variación, ratio long/short, taker y liquidaciones. |
| Liquidez en stablecoins | Capital en stablecoins del dólar y su variación a 7 y 30 días. |
| Score de Oportunidad | Media ponderada de 7 bloques, con confianza y desglose auditable. |
| Transacciones/día · Direcciones activas | Actividad on-chain diaria (Coin Metrics). |
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
BITCOIN_RPC_URL= / _USER= / _PASSWORD=   # opcional, nodo propio
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
respaldo. El rango MAX preserva primer/último punto y extremos, y reduce puntos
únicamente para el renderizado. Los indicadores técnicos de ciclo largo (incluida la
media de 200 semanas) salen de Coin Metrics, que sí sirve el histórico completo.

La interfaz es una SPA con cinco vistas principales (`Inicio`, `Ciclos`, `Oportunidad`,
`Análisis` y `Ajustes`). El precio está integrado en Inicio; Ciclos, Oportunidad y los
indicadores de Análisis se abren desplegados y pueden plegarse individualmente. Mantiene
moneda y cachés al cambiar de vista, usa rutas estables por query string y deja el estado
de proveedores en el panel compacto **En vivo**.

## 6. Limitaciones de cada fuente

- **Binance:** los streams se abren desde el navegador (no hay forma de tener
  tiempo real vía servidor sin mantener un proceso permanente). El precio spot se
  ha verificado funcionando; el canal de liquidaciones abre correctamente pero en
  algunas redes corporativas y proxys no entrega tramas, y en ese caso la tarjeta
  lo dice en lugar de fingir que no hay liquidaciones.
- **Coin Metrics Community:** gratuito y sin clave, pero **solo publica el cierre
  del día anterior**. Es la fuente de los técnicos de largo plazo porque es la
  única gratuita que llega a los 1.400 cierres de la media de 200 semanas.
- **CoinGecko (gratis):** límite ~10–30 req/min y **histórico limitado a 365 días**;
  por eso los técnicos largos no salen de aquí. Si rechaza la petición, el servidor
  pasa a CoinPaprika y el gráfico a Kraken.
- **alternative.me:** el índice se publica ~1 vez al día.
- **DefiLlama:** recalcula cada pocas horas; las variaciones son a 1, 7 y 30 días.
- **mempool.space:** mempool y comisiones casi en tiempo real; la fecha del halving
  es una **estimación** (asume 10 min/bloque).
- **FRED:** periodicidad real por serie (diaria/semanal/**mensual**); se muestra la
  fecha de observación, nunca como dato intradía.
- **ETF spot e ISM:** sin fuente pública gratuita fiable. Se han retirado del score
  en lugar de alimentarlo con series simuladas.

## 7. Política de cache y frecuencia

Cache en servidor con **stale-while-revalidate** (in-memory; Upstash opcional) +
refetch en cliente con TanStack Query:

| Bloque | Cache servidor | Refresco cliente |
|---|---|---|
| Precio en vivo (Binance WS) | — (stream) | instantáneo, 2 renders/s máx. |
| Libro de órdenes (Binance) | — (directo) | 4 s |
| Derivados (Binance Futures) | 60 s | 60 s |
| Precio / global (CoinGecko) | 60 s | 60 s |
| Técnicos y ciclo (Coin Metrics) | 6 h | con el bloque de mercado |
| Liquidez (DefiLlama) | 6 h | con el bloque de mercado |
| Fear & Greed | 30 min | con el bloque de mercado |
| Red Bitcoin (mempool.space) | 1 min · hashrate 30 min | 60 s |
| Macro (FRED) | 6 h | 6 h |
| Histórico de gráficos | 1–6 h según rango | bajo demanda |
| Estado de fuentes | 30 s | 60 s |

Ante un fallo del proveedor se sirve el último dato válido marcado como **«retrasado»**;
si nunca hubo dato, **«no disponible»**. Cada respuesta incluye su estado de frescura,
fuente y hora (UTC interno, mostrado en **Europe/Madrid**).

---

## Arquitectura

```
api/                      backend (Worker / Node)
├─ dashboard|market|network|onchain|macro|health.ts   rutas
└─ _lib/
   ├─ http.ts             fetch con timeout + reintentos backoff exponencial
   ├─ cache.ts            stale-while-revalidate en memoria
   ├─ rateLimit.ts        límite por IP
   ├─ respond.ts          envelope normalizado + CORS + helpers
   └─ providers/          coingecko, coinmetrics, defillama, binance,
                          mempool, alternativeme, fred, technicals (Zod)
src/
├─ services/realtime/     socketHub (una conexión por URL, backoff, pausa
│                         por visibilidad), binance, binanceRest
├─ hooks/                 useMarketData, useRealtime, useNetwork,
│                         useOnchainMetrics, useHealth (TanStack Query)
├─ lib/indicators.ts      RSI, medias, volatilidad, rendimientos (puro)
├─ lib/score/             Score de Oportunidad por bloques ponderados
├─ lib/data/client.ts     cliente único de /api
├─ contexts/              CurrencyContext (EUR/USD global)
├─ components/views/      Inicio, Análisis, Ajustes y Aviso legal
└─ components/sections/   Precio, Ciclos, Oportunidad, presión de mercado,
                          apalancamiento, Red Bitcoin, on-chain, macro
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

✅ **Sección on-chain** con datos reales y gratuitos: MVRV, NUPL, capitalización
realizada, Puell Multiple, hashrate, tx/día, direcciones, supply y liquidez en
stablecoins. Ya no hay tarjetas «bloqueadas de pago»: lo que no se puede obtener
gratis está documentado en el apartado 1 en lugar de ocupar sitio en la interfaz.

✅ **Mercado en vivo**: precio por WebSocket, presión del libro de órdenes,
apalancamiento en futuros y liquidaciones, con una única conexión compartida que se
pausa al ocultar la pestaña.

✅ **Score de Oportunidad** por bloques ponderados, con redistribución de pesos si
falta una fuente, nivel de confianza y desglose auditable. Aparece una sola vez.

`.env.example`, tests y build verde.

