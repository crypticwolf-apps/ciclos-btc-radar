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
 * altcoins superan a BTC y cuántas están sobre sus medias), ETH/BTC, la
 * dominancia de BTC y la capitalización sin BTC. Volumen y stablecoins siguen
 * siendo los del último cálculo completo del servidor (cada 30 min). Con esas métricas se vuelve a pasar la MISMA
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

  Object.assign(metrics, liveMarket(data, ranking, btc));

  // La parte que no va en vivo tiene la edad del último cálculo completo.
  const ageHours = Math.max(0, (now - Date.parse(data.observedAt)) / 3_600_000);
  metrics.dataAgeHours = Number.isFinite(ageHours) ? ageHours : null;
  metrics.fromCache = ageHours > 1;

  return { ...data, ranking, metrics, result: calculateAltseasonScore(metrics) };
}

/**
 * Dominancia de BTC y capitalización sin BTC con los precios en vivo.
 *
 * La capitalización total se mueve con lo que cambia la de BTC y la de cada
 * moneda del ranking (que ya llega escalada por su precio). Lo que queda fuera
 * del ranking son sobre todo stablecoins, que no cambian de precio, así que se
 * mantiene. Las variaciones a 24 h, 7 y 30 días se miden contra la MISMA
 * referencia pasada que usó el servidor; solo cambia el «ahora».
 */
function liveMarket(
  data: AltseasonResponse,
  ranking: AltcoinRow[],
  btcPrice: number,
): Partial<AltseasonResponse['metrics']> {
  const m = data.metrics;
  const refPrice = data.btcRef?.price;
  const btcCap = data.btcRef?.marketCap;
  if (!refPrice || !btcCap || m.totalMarketCap == null || m.btcDominance == null) return {};
  if (!samePrice(btcPrice, refPrice)) return {};

  const btcNow = btcCap * (btcPrice / refPrice);
  const altsDelta = ranking.reduce((acc, r, i) => acc + (r.marketCapUsd - (data.ranking[i]?.marketCapUsd ?? r.marketCapUsd)), 0);
  const total = m.totalMarketCap + altsDelta + (btcNow - btcCap);
  if (!(total > 0)) return {};

  const dominance = (btcNow / total) * 100;
  const desde = (change: number | null) =>
    change == null ? null : Number((dominance - (m.btcDominance! - change)).toFixed(3));

  const exNow = total - btcNow;
  const ethIdx = ranking.findIndex((r) => r.symbol === 'ETH');
  const ethDelta = ethIdx === -1 ? 0 : ranking[ethIdx]!.marketCapUsd - data.ranking[ethIdx]!.marketCapUsd;
  const exServer = m.marketCapExBtc ?? m.totalMarketCap - btcCap;
  // Capitalización sin BTC de hace 7 y 30 días, la misma que usó el servidor.
  const exAgo = (pct: number | null) => (pct == null ? null : exServer / (1 + pct / 100));
  const exChange = (pct: number | null) => {
    const ago = exAgo(pct);
    return ago && ago > 0 ? Number((((exNow - ago) / ago) * 100).toFixed(2)) : null;
  };
  const ex30 = exChange(m.exBtcChange30d);
  // BTC a 30 días con la base del servidor, movida con el precio de ahora.
  const btc30Server = m.exBtcChange30d != null && m.exBtcVsBtc30d != null ? m.exBtcChange30d - m.exBtcVsBtc30d : null;
  const btc30 = btc30Server == null ? null : ((1 + btc30Server / 100) * (btcPrice / refPrice) - 1) * 100;

  return {
    btcDominance: Number(dominance.toFixed(2)),
    dominanceChange24h: desde(m.dominanceChange24h),
    dominanceChange7d: desde(m.dominanceChange7d),
    dominanceChange30d: desde(m.dominanceChange30d),
    totalMarketCap: Math.round(total),
    marketCapExBtc: Math.round(exNow),
    marketCapExBtcEth: m.marketCapExBtcEth == null ? null : Math.round(m.marketCapExBtcEth + (exNow - exServer) - ethDelta),
    exBtcChange7d: exChange(m.exBtcChange7d),
    exBtcChange30d: ex30,
    exBtcVsBtc30d: ex30 != null && btc30 != null ? Number((ex30 - btc30).toFixed(2)) : m.exBtcVsBtc30d,
  };
}
