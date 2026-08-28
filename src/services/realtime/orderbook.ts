import type { Envelope } from '@/types/api';

// =============================================================================
// Presión del libro de órdenes, pedida a NUESTRA API.
//
// La versión anterior de este archivo hablaba directamente con Binance desde el
// navegador y era el único dato de la aplicación sin cadena de respaldo: quien
// tuviera Binance bloqueado —por país, por la red de su empresa o por una
// extensión— veía «No disponible» para siempre. `/api/orderbook` prueba
// Binance, OKX y Bybit desde el servidor y dice cuál respondió.
// =============================================================================

export interface MarketPressure {
  /** % del volumen del libro que está en el lado comprador (0-100). */
  buyPct: number;
  sellPct: number;
  /** Desequilibrio normalizado -1..1 (positivo = domina la compra). */
  imbalance: number;
  /** Volumen agregado a cada lado, en BTC. */
  bidVolume: number;
  askVolume: number;
  spread: number;
  spreadPct: number;
  /** Exchange que sirvió el libro. */
  source: string;
  at: number;
}

export async function fetchOrderBookPressure(signal: AbortSignal): Promise<MarketPressure> {
  const response = await fetch('/api/orderbook', { signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`La API respondió ${response.status}`);
  const envelope = (await response.json()) as Envelope<Omit<MarketPressure, 'at'>>;
  if (!envelope.ok || !envelope.data) {
    throw new Error(envelope.error ?? 'Libro de órdenes no disponible');
  }
  return { ...envelope.data, at: Date.parse(envelope.meta.generatedAt) || Date.now() };
}
