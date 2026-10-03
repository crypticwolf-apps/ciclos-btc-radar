import type { AltcoinRow } from '@/types/altseason';
import { samePrice } from '@/lib/altseason/config';

// =============================================================================
// Ranking de altcoins EN VIVO.
//
// El servidor calcula cada 30 min lo que solo cambia una vez al día —cierres de
// hace 7, 30 y 90 días, máximo de 90 días, medias móviles— y lo manda en
// `row.ref`. Con eso y el último precio, aquí se rehace la fila entera cada
// pocos segundos: precio, capitalización, variaciones, «vs BTC», distancia al
// máximo y posición frente a sus medias.
//
// Las variaciones se miden contra el cierre de hace N días, que es la misma
// definición que usa el servidor; así el número en vivo y el del recálculo
// completo coinciden cuando llega el siguiente.
// =============================================================================

const pct = (now: number, then: number | null) =>
  then != null && then > 0 ? Number((((now - then) / then) * 100).toFixed(2)) : null;

/**
 * Fila recalculada con el precio en vivo. Sin precio vivo, sin referencias
 * (respuesta antigua del servidor) o con un precio que no es de esa moneda,
 * devuelve la fila tal cual: nunca mezcla un precio nuevo con variaciones viejas.
 */
export function liveRow(
  row: AltcoinRow,
  price: number | undefined,
  btcChange90: number | null,
): AltcoinRow {
  const ref = row.ref;
  if (!ref || price == null || !(price > 0)) return row;
  // Un precio que no cuadra con el del último cálculo (hace como mucho 30 min)
  // es de otra moneda con el mismo símbolo, o un par sin negociación: se ignora.
  if (ref.price > 0 && !samePrice(price, ref.price)) return row;

  const change90d = pct(price, ref.close90);
  const high = ref.high90 != null ? Math.max(ref.high90, price) : null;
  return {
    ...row,
    priceUsd: price,
    // La oferta en circulación no cambia en segundos: la capitalización se
    // mueve con el precio.
    marketCapUsd: ref.price > 0 ? (row.marketCapUsd * price) / ref.price : row.marketCapUsd,
    change7d: pct(price, ref.close7) ?? row.change7d,
    change30d: pct(price, ref.close30) ?? row.change30d,
    change90d: change90d ?? row.change90d,
    vsBtc90d:
      change90d != null && btcChange90 != null ? Number((change90d - btcChange90).toFixed(2)) : row.vsBtc90d,
    fromHigh90d: high != null && high > 0 ? Number((((price - high) / high) * 100).toFixed(1)) : row.fromHigh90d,
    aboveSma20: ref.sma20 == null ? row.aboveSma20 : price > ref.sma20,
    aboveSma50: ref.sma50 == null ? row.aboveSma50 : price > ref.sma50,
    aboveSma200: ref.sma200 == null ? row.aboveSma200 : price > ref.sma200,
    beatsBtc: change90d != null && btcChange90 != null ? change90d > btcChange90 : row.beatsBtc,
  };
}

/** Rendimiento de BTC a 90 días con su precio en vivo. */
export function btcChange90Live(btcPrice: number | undefined, btcClose90: number | null | undefined): number | null {
  return btcPrice != null && btcPrice > 0 ? pct(btcPrice, btcClose90 ?? null) : null;
}
