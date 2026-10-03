import type { AltcoinRow, AltseasonResponse } from '@/types/altseason';
import { samePrice } from '@/lib/altseason/config';
import { breadthMetrics } from '@/lib/altseason/breadth';
import { calculateAltseasonScore } from '@/lib/altseason/score';

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
    change60d: pct(price, ref.close60 ?? null) ?? row.change60d,
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

/**
 * El análisis completo con los precios en vivo.
 *
 * Se rehace lo que depende del precio: el ranking, la amplitud (cuántas
 * altcoins superan a BTC y cuántas están sobre sus medias) y ETH/BTC. Lo que
 * no se puede saber a cada segundo —dominancia, capitalización del mercado
 * entero, volumen y stablecoins— sigue siendo el del último cálculo completo
 * del servidor (cada 30 min). Con esas métricas se vuelve a pasar la MISMA
 * fórmula del score.
 *
 * Sin precio vivo de BTC no se toca nada: todo depende de compararse con él.
 */
export function liveAltseason(
  data: AltseasonResponse,
  prices: Record<string, number> | undefined,
  now = Date.now(),
): AltseasonResponse {
  const btc = prices?.BTC;
  if (!prices || btc == null || !(btc > 0) || !data.btcRef) return data;

  const ref = data.btcRef;
  const r90 = pct(btc, ref.close90);
  const ranking = data.ranking.map((r) => liveRow(r, prices[r.symbol], r90));
  const breadth = breadthMetrics(ranking, {
    r90,
    r60: pct(btc, ref.close60 ?? null),
    r30: pct(btc, ref.close30 ?? null),
  });

  const metrics = { ...data.metrics };
  // Sin la referencia de 30 o 60 días (respuesta antigua) se queda el dato del servidor.
  for (const [k, v] of Object.entries(breadth) as [keyof typeof breadth, number | null][]) {
    if (v != null || (k !== 'outperform30Pct' && k !== 'outperform60Pct')) {
      (metrics as Record<string, unknown>)[k] = v;
    }
  }

  const eth = prices.ETH;
  const e = data.ethBtcRef;
  if (e && eth != null && eth > 0) {
    const ethBtc = eth / btc;
    // Mismo filtro que las filas: un ETH/BTC que no cuadra no se usa.
    if (samePrice(ethBtc, e.close1)) {
      metrics.ethBtc = Number(ethBtc.toFixed(6));
      metrics.ethBtcChange24h = pct(ethBtc, e.close1);
      metrics.ethBtcChange7d = pct(ethBtc, e.close7);
      metrics.ethBtcChange30d = pct(ethBtc, e.close30);
      metrics.ethBtcChange90d = pct(ethBtc, e.close90);
    }
  }

  // La parte que no va en vivo tiene la edad del último cálculo completo.
  const ageHours = Math.max(0, (now - Date.parse(data.observedAt)) / 3_600_000);
  metrics.dataAgeHours = Number.isFinite(ageHours) ? ageHours : null;
  metrics.fromCache = ageHours > 1;

  return { ...data, ranking, metrics, result: calculateAltseasonScore(metrics) };
}
