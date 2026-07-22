/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Activa las llamadas a APIs reales (CoinGecko, Fear & Greed, etc.). */
  readonly VITE_LIVE_DATA?: string;
  /** API key DEMO opcional de CoinGecko (sube el límite de peticiones). */
  readonly VITE_COINGECKO_KEY?: string;
  /** Base del proxy macro (FRED). Por defecto "/fred" (proxy de Vite en dev). */
  readonly VITE_MACRO_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
