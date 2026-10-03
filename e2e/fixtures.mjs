// =============================================================================
// Datos de ejemplo para las pruebas de pantalla (e2e/smoke.spec.ts).
//
// Imitan las respuestas reales de /api/* para poder abrir cada pantalla sin
// depender de los proveedores externos. Los precios en vivo se mueven en cada
// petición, y TON trae a propósito un precio de otra moneda con el mismo
// símbolo, que la app debe ignorar.
// =============================================================================

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const D = 86_400_000;
const env = (data, sources = []) => ({ ok: true, data, meta: { generatedAt: iso(now), sources } });
const src = (provider, status = 'live', extra = {}) => ({ provider, status, fetchedAt: iso(now - 5 * 60_000), ...extra });

// Serie diaria sintética de precio (5 años) para el gráfico.
const points = [];
for (let i = 1825; i >= 0; i--) {
  const t = now - i * D;
  const base = 20_000 * Math.exp((1825 - i) / 900);
  points.push({ t, price: Math.round(base * (1 + 0.15 * Math.sin(i / 40) + 0.04 * Math.sin(i / 7))) });
}
const price = 78_400;

// --- Macro: forma nueva (valor, anterior, tendencia, minigráfica…) ----------
const spark = (from, to, n = 13, wob = 0) =>
  Array.from({ length: n }, (_, i) => Number((from + ((to - from) * i) / (n - 1) + wob * Math.sin(i)).toFixed(2)));
const m = (id, fredId, label, group, format, unit, value, previous, previousAt, changeLabel, trend, sp, frequency, cadence, observedAt, extra = {}) => ({
  id, fredId, label, group, format, unit, value, observedAt, previous, previousAt,
  change: previous == null ? null : Number((value - previous).toFixed(2)), changeLabel, trend, spark: sp,
  frequency, cadence, fetchedAt: iso(now - 20 * 60_000), definicion: `Definición de ${label}.`, ...extra,
});
const m2History = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(Date.UTC(2024, 8 + i, 1));
  return { period: `${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, value: Number((1.2 + i * 0.16 + 0.4 * Math.sin(i / 3)).toFixed(2)), at: d.toISOString().slice(0, 10) };
});
export const macro = {
  series: [
    m('liquidez', 'M2SL', 'Masa monetaria M2', 'liquidez', 'pct', '% interanual', 4.62, 4.41, '2026-07-01', 'vs mes anterior', 'sube', spark(2.9, 4.62), 'mensual', 'Mensual · la Fed lo publica hacia el 4.º martes del mes siguiente', '2026-08-01', { history: m2History }),
    m('liquidez-fed', 'WALCL−WTREGEN−RRPONTSYD', 'Liquidez neta de la Fed', 'liquidez', 'usd-bn', 'miles de millones $', 5784.2, 5741.6, '2026-09-23', 'vs semana anterior', 'sube', spark(5610, 5784, 26, 30), 'semanal', 'Semanal · cada jueves, con el balance del miércoles', '2026-09-30'),
    m('fedfunds', 'DFF', 'Tipo de la Fed', 'politica', 'pct', '%', 3.58, 3.83, '2026-09-01', 'vs hace 1 mes', 'baja', spark(4.08, 3.58, 30), 'diaria', 'Diaria · tipo efectivo del día anterior', '2026-10-01'),
    m('inflacion', 'CPIAUCSL', 'Inflación (IPC)', 'politica', 'pct', '% interanual', 2.84, 2.91, '2026-07-01', 'vs mes anterior', 'estable', spark(3.1, 2.84, 13, 0.08), 'mensual', 'Mensual · hacia mediados del mes siguiente', '2026-08-01'),
    m('tipo-real', 'DFII10', 'Tipo real 10 años', 'politica', 'pct', '%', 1.71, 1.92, '2026-09-01', 'vs hace 1 mes', 'baja', spark(2.05, 1.71, 30, 0.05), 'diaria', 'Diaria · días hábiles', '2026-10-01'),
    m('spread', 'T10Y2Y', 'Curva 10A – 2A', 'politica', 'pp', 'puntos', 0.58, 0.49, '2026-09-01', 'vs hace 1 mes', 'sube', spark(0.32, 0.58, 30, 0.03), 'diaria', 'Diaria · días hábiles', '2026-10-01'),
    m('actividad', 'CFNAIMA3', 'Actividad (CFNAI)', 'crecimiento', 'difusion', 'índice, media 3 meses', -0.12, -0.21, '2026-07-01', 'vs mes anterior', 'sube', spark(-0.35, -0.12, 13, 0.05), 'mensual', 'Mensual · hacia final del mes siguiente', '2026-08-01'),
    m('manufactura', 'GACDFSA066MSFRBPHI', 'Manufactura (Filadelfia)', 'crecimiento', 'difusion', 'índice de difusión', 8.4, -3.1, '2026-08-01', 'vs mes anterior', 'sube', spark(-9, 8.4, 13, 4), 'mensual', 'Mensual · 3.er jueves del mismo mes', '2026-09-01'),
    m('desempleo', 'UNRATE', 'Desempleo', 'crecimiento', 'pct', '%', 4.4, 4.3, '2026-08-01', 'vs mes anterior', 'sube', spark(4.1, 4.4), 'mensual', 'Mensual · primer viernes del mes siguiente', '2026-09-01'),
    m('condiciones', 'NFCI', 'Condiciones (NFCI)', 'condiciones', 'difusion', 'índice', -0.52, -0.5, '2026-09-19', 'vs semana anterior', 'estable', spark(-0.47, -0.52, 26, 0.01), 'semanal', 'Semanal · cada miércoles', '2026-09-26'),
    m('high-yield', 'BAMLH0A0HYM2', 'Spread high yield', 'condiciones', 'pct', '% sobre el Tesoro', 3.12, 3.05, '2026-09-01', 'vs hace 1 mes', 'estable', spark(3.3, 3.12, 30, 0.08), 'diaria', 'Diaria · días hábiles', '2026-10-01'),
    m('vix', 'VIXCLS', 'VIX', 'condiciones', 'indice', 'índice', 17.4, 15.2, '2026-09-01', 'vs hace 1 mes', 'sube', spark(14.8, 17.4, 30, 1.2), 'diaria', 'Diaria · días hábiles', '2026-10-01'),
    m('dolar', 'DTWEXBGS', 'Dólar amplio', 'condiciones', 'indice', 'índice', 119.8, 121.6, '2026-08-26', 'vs hace 1 mes', 'baja', spark(123, 119.8, 30, 0.4), 'diaria', 'Diaria · la Fed la publica cada lunes', '2026-09-26'),
  ],
  missing: [],
};

const halvings = [
  { year: '2012', at: '2012-11-28T15:24:38Z', block: 210000, reward: '25 BTC', cycleLow: 2.11, cycleLowDate: '2011-11-18T00:00:00.000Z', priceAtHalving: 12.35, cyclePeak: 1151, cyclePeakDate: '2013-12-04T00:00:00.000Z', lowToPeakPct: 54450, cycleOpen: false, current: false, halvingEstimated: false, sameDay: { days: 897, date: '2015-05-14T00:00:00.000Z', price: 237.1, fromHalvingPct: 1820, fromPeakPct: -79 } },
  { year: '2016', at: '2016-07-09T16:46:13Z', block: 420000, reward: '12,5 BTC', cycleLow: 175.64, cycleLowDate: '2015-01-14T00:00:00.000Z', priceAtHalving: 650.6, cyclePeak: 19497, cyclePeakDate: '2017-12-17T00:00:00.000Z', lowToPeakPct: 11000, cycleOpen: false, current: false, halvingEstimated: false, sameDay: { days: 897, date: '2018-12-23T00:00:00.000Z', price: 3990, fromHalvingPct: 513, fromPeakPct: -80 } },
  { year: '2020', at: '2020-05-11T19:23:43Z', block: 630000, reward: '6,25 BTC', cycleLow: 3185, cycleLowDate: '2018-12-15T00:00:00.000Z', priceAtHalving: 8601, cyclePeak: 67542, cyclePeakDate: '2021-11-08T00:00:00.000Z', lowToPeakPct: 2021, cycleOpen: false, current: false, halvingEstimated: false, sameDay: { days: 897, date: '2022-10-25T00:00:00.000Z', price: 20090, fromHalvingPct: 134, fromPeakPct: -70 } },
  { year: '2024', at: '2024-04-20T00:09:27Z', block: 840000, reward: '3,125 BTC', cycleLow: 15758, cycleLowDate: '2022-11-21T00:00:00.000Z', priceAtHalving: 64994, cyclePeak: 124725, cyclePeakDate: '2025-10-06T00:00:00.000Z', lowToPeakPct: 691, cycleOpen: false, current: false, halvingEstimated: false, sameDay: { days: 897, date: '2026-10-02T00:00:00.000Z', price: 78400, fromHalvingPct: 21, fromPeakPct: -37 } },
  { year: '2028', at: '2028-04-11T09:00:00.000Z', block: 1050000, reward: '1,5625 BTC', cycleLow: 61850, cycleLowDate: '2026-04-02T00:00:00.000Z', priceAtHalving: null, cyclePeak: null, cyclePeakDate: null, lowToPeakPct: null, cycleOpen: true, current: true, halvingEstimated: true, sameDay: null },
];

const halvingProgress = { blockHeight: 916_450, lastHalvingBlock: 840000, nextHalvingBlock: 1050000, blocksRemaining: 133_550, progress: 0.364, estimatedDaysRemaining: 921, estimatedDate: '2028-04-11T09:00:00.000Z' };

export const dashboard = env({
  market: {
    summary: { priceUsd: price, priceEur: price * 0.86, change1h: 0.3, change24h: 1.8, change7d: 4.2, change30d: 9.1, change1y: -12.4, marketCapUsd: price * 19_930_000, volume24hUsd: 38_100_000_000, ath: 124_725, athDate: '2025-10-06T00:00:00.000Z', fromAthPct: -37.14 },
    global: { marketCapUsd: 2_620_000_000_000, volume24hUsd: 91_000_000_000, btcDominance: 59.1, marketCapChange24h: 1.2 },
    indicators: { rsi14: 56.2, sma50: price * 0.95, sma200: price * 1.06, sma200w: price * 0.66, cross: 'ninguno', volatility30d: 41.5, return7d: 4.2, return30d: 9.1, return90d: 6.3, return365d: -12.4, trend: 'lateral', cycleLow: 15_758, cycleHigh: 124_725, minYear: 61_850, maxYear: 124_725, samples: 5800 },
    sentiment: { value: 44, classification: 'Miedo', changeVsYesterday: 3, updatedAt: iso(now), history: Array.from({ length: 30 }, (_, i) => ({ value: 30 + ((i * 7) % 25), date: iso(now - (29 - i) * D) })) },
    sentimentExtremes: [
      { label: 'feb 2018', value: 8, date: '2018-02-05T00:00:00Z', current: false },
      { label: 'mar 2020', value: 8, date: '2020-03-12T00:00:00Z', current: false },
      { label: 'jun 2022', value: 6, date: '2022-06-19T00:00:00Z', current: false },
      { label: 'Actual', value: 44, date: iso(now), current: true },
    ],
    fx: { eurPerUsd: 0.86, source: 'derivado', observedAt: iso(now) },
  },
  onchain: {
    halving: halvingProgress,
    cycle: { mvrv: 1.62, nupl: 0.38, realizedCapUsd: 960_000_000_000, marketCapUsd: price * 19_930_000, puell: 0.88, observedAt: day(now - D), history: [] },
    halvings,
    flow: { timeline: Array.from({ length: 6 }, (_, i) => ({ period: `S${i + 1}`, whaleIndex: 100 + i * 3, retailIndex: 100 - i * 2, priceK: 70 + i * 1.5, current: i === 5 })), recentWhaleChange: 15, recentRetailChange: -10, recentPriceChange: 8, weeks: 6, observedAt: day(now - D) },
  },
  network: {
    mempool: { pendingTx: 42_180, vsizeMb: 61, totalFeeBtc: 1.9, blocksToClear: 4 },
    strength: { hashrateEhs: 1020, difficultyT: 138.4, retargetProgressPct: 62, nextAdjustmentPct: 1.8, blocksToRetarget: 760, retargetDate: iso(now + 5 * D), avgBlockMinutes: 9.8 },
    latestBlock: { height: 916_450, minedAt: iso(now - 7 * 60_000), txCount: 3184, sizeMb: 1.6 },
  },
  liquidity: { totalUsd: 248_000_000_000, change24hPct: 0.1, change7dPct: 0.7, change30dPct: 2.6, trend: 'expansion', top: [{ symbol: 'USDT', name: 'Tether', circulatingUsd: 168e9, change7dPct: 0.6, change30dPct: 2.9 }, { symbol: 'USDC', name: 'USD Coin', circulatingUsd: 61e9, change7dPct: 1.1, change30dPct: 3.4 }], observedAt: day(now) },
  derivatives: { fundingRate: 0.000071, nextFundingAt: now + 3 * 3_600_000, markPrice: price, indexPrice: price - 6, openInterestBtc: 91_300, openInterestUsd: 91_300 * price, openInterestChange24hPct: 2.4, longShortRatio: 1.31, longAccountPct: 56.7, takerBuySellRatio: 1.04, source: 'okx' },
  macro,
  history: {
    cyclePoints: [
      { label: '2011', price: 31, at: '2011-06-08', kind: 'pico' }, { label: '2011', price: 2.1, at: '2011-11-18', kind: 'suelo' },
      { label: '2013', price: 1151, at: '2013-12-04', kind: 'pico' }, { label: '2015', price: 176, at: '2015-01-14', kind: 'suelo' },
      { label: '2017', price: 19497, at: '2017-12-17', kind: 'pico' }, { label: '2018', price: 3185, at: '2018-12-15', kind: 'suelo' },
      { label: '2021', price: 67542, at: '2021-11-08', kind: 'pico' }, { label: '2022', price: 15758, at: '2022-11-21', kind: 'suelo' },
      { label: '2025', price: 124725, at: '2025-10-06', kind: 'pico' }, { label: 'Actual', price, at: day(now), kind: 'actual' },
    ],
    cycles: [],
    drawdowns: [
      { period: '2013-15', drawdownPct: -85, recoveryPct: 11000, current: false },
      { period: '2017-18', drawdownPct: -84, recoveryPct: 2021, current: false },
      { period: '2021-22', drawdownPct: -77, recoveryPct: 691, current: false },
      { period: 'Actual', drawdownPct: -50, recoveryPct: null, current: true },
    ],
    yearlyLows: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y, i) => ({ year: String(y), low: [780, 3185, 3400, 4900, 29_800, 15_758, 16_500, 38_500, 74_400, 61_850][i] })),
    rsiBottoms: [
      { label: 'ene 2015', rsi: 24.8, return1yPct: 120, current: false },
      { label: 'dic 2018', rsi: 22.1, return1yPct: 105, current: false },
      { label: 'mar 2020', rsi: 18.6, return1yPct: 1060, current: false },
      { label: 'jun 2022', rsi: 21.4, return1yPct: -12, current: false },
    ],
    observedAt: day(now - D),
    source: 'coinmetrics:serie',
  },
}, [src('coingecko'), src('fred'), src('halvings:coinmetrics:serie')]);

export const marketHistory = env({ days: 'max', currency: 'usd', points }, [src('coingecko')]);

export const network = env({
  fees: { fastestFee: 9, halfHourFee: 6, hourFee: 4, economyFee: 2, minimumFee: 1 },
  mempool: dashboard.data.network.mempool,
  strength: dashboard.data.network.strength,
  latestBlock: dashboard.data.network.latestBlock,
  halving: halvingProgress,
}, [src('mempool.space:fees'), src('mempool.space:hashrate')]);

export const onchain = env({
  cycle: dashboard.data.onchain.cycle,
  activity: { metrics: [
    { id: 'hashrate', label: 'Hashrate', value: 1020, unit: 'EH/s', changePct: 3.2, observedAt: day(now - D) },
    { id: 'tx', label: 'Transacciones/día', value: 412_000, unit: 'tx', changePct: -1.4, observedAt: day(now - D) },
    { id: 'addresses', label: 'Direcciones activas', value: 742_000, unit: 'dir.', changePct: -2.8, observedAt: day(now - D) },
    { id: 'supply', label: 'Supply circulante', value: 19_930_000, unit: 'BTC', changePct: 0.1, observedAt: day(now - D) },
  ] },
  liquidity: dashboard.data.liquidity,
  halving: halvingProgress,
}, [src('coinmetrics'), src('coinmetrics:activity'), src('defillama')]);

export const orderbook = env({ buyPct: 56.4, sellPct: 43.6, imbalance: 0.128, bidVolume: 41.2, askVolume: 31.8, spread: 1.4, spreadPct: 0.0012, source: 'okx' }, [src('okx')]);

const comp = (id, label, score, weight, raw) => ({ id, label, score, weight, effectiveWeight: weight, rawValue: raw, explanation: '' });
const SYMS = ['ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','LINK','DOT','TRX','TON','SUI','INJ','ETC','NEAR','APT','ARB','OP','PEPE','SHIB'];
export const altseason = env({
  result: {
    score: 38, unavailableReason: null, classification: 'Rotación temprana', summary: 'El capital empieza a moverse hacia algunas altcoins, pero Bitcoin sigue dominando.',
    phase: 'rotacion-eth', phaseLabel: 'Rotación hacia Ethereum', confidence: 'alta', coverage: 100, componentsAvailable: 7, componentsTotal: 7, missing: [],
    components: [comp('outperformance', 'Superan a BTC (90 d)', 41, 30, '41%'), comp('dominance', 'Dominancia BTC (30 d)', 45, 20, '−0,4 pp'), comp('breadth', 'Sobre su media de 50 d', 38, 15, '38%'), comp('ethbtc', 'ETH/BTC (30 d)', 52, 15, '+1,2%'), comp('marketExBtc', 'Cap. sin BTC vs BTC', 40, 10, '−0,8 pp'), comp('volume', 'Volumen en altcoins', 35, 5, '38%'), comp('volatility', 'Volatilidad relativa', 30, 5, '1,4×')],
    signalsFor: [{ text: 'ETH/BTC sube en el último mes', evidence: 'ETH/BTC +1,2% en 30 d' }, { text: 'La dominancia de BTC cede ligeramente', evidence: '−0,4 pp en 30 d' }],
    signalsAgainst: [{ text: 'Menos de la mitad de las altcoins supera a BTC', evidence: '41% en 90 d' }, { text: 'Amplitud débil', evidence: '38% sobre su media de 50 d' }, { text: 'El volumen sigue concentrado en BTC', evidence: '62% del volumen' }],
    penalties: [], scenarios: { confirm: [], continue: [], invalidate: [] },
  },
  metrics: {
    outperform90Pct: 41, outperform60Pct: 39, outperform30Pct: 44, outperformCount: 41, analyzedCount: 100, btcReturn90: 6.3,
    btcDominance: 59.1, dominanceChange24h: -0.1, dominanceChange7d: -0.2, dominanceChange30d: -0.4,
    aboveSma20Pct: 52, aboveSma50Pct: 38, aboveSma200Pct: 27, positive7dPct: 61, positive30dPct: 48, positive90dPct: 35, near90dHighCount: 9, drawdown20PlusCount: 44,
    ethBtc: 0.0381, ethBtcChange24h: 0.2, ethBtcChange7d: 0.6, ethBtcChange30d: 1.2, ethBtcChange90d: -3.1,
    totalMarketCap: 2.62e12, marketCapExBtc: 1.06e12, marketCapExBtcEth: 0.62e12, exBtcVsBtc30d: -0.8, exBtcChange7d: 2.1, exBtcChange30d: 8.3,
    altVolumeSharePct: 38, btcVolumeUsd: 38e9, altVolumeUsd: 23e9, avgAltVolatility: 68, btcVolatility: 41.5, top5Concentration: 0.42,
  },
  ranking: Array.from({ length: 20 }, (_, i) => ({ symbol: SYMS[i], name: SYMS[i], priceUsd: i === 18 ? 0.0000123 : i === 2 ? 2.4712 : 100 - i * 4.5, marketCapUsd: (12 - i) * 2e10, volumeUsd: 1e9, change7d: 3 - i, change30d: 10 - i * 2, change60d: 5 - i, change90d: 12 - i * 3, vsBtc90d: 6 - i * 3, fromHigh90d: -10 - i * 2, aboveSma20: i % 2 === 0, aboveSma50: i % 3 === 0, aboveSma200: i < 3, volatility30d: 50 + i * 3, beatsBtc: i < 4, ref: ((p) => ({ price: p, close7: p / 1.03, close30: p / 1.1, close60: p / 1.05, close90: p / (1.12 - i * 0.01), high90: p * 1.15, sma20: p * 0.98, sma50: p * 1.02, sma200: p * 1.05 }))(i === 18 ? 0.0000123 : i === 2 ? 2.4712 : 100 - i * 4.5) })),
  btcRef: { price: 78_400, marketCap: 1.55e12, close30: 75_000, close60: 74_000, close90: 73_700 },
  ethBtcRef: { close1: 0.033, close7: 0.032, close30: 0.03, close90: 0.028 },
  exchange: 'okx',
  breadthHistory: Array.from({ length: 30 }, (_, i) => ({ t: now - (29 - i) * D, outperformPct: 30 + i * 0.4 + 4 * Math.sin(i / 3) })),
  universeSize: 250, excludedCount: 38, observedAt: iso(now - 12 * 60_000),
}, [src('coingecko:altseason')]);

const faseCodes = points.map((_, i) => 'ctvecrakt'[Math.floor(i / 140) % 9] ?? 'a').join('');
export const historial = env({
  configured: true,
  fases: { desde: day(points[0].t), fases: faseCodes, precios: points.map((p) => p.price), source: 'coinmetrics:serie' },
  days: Array.from({ length: 75 }, (_, i) => {
    const t = now - (74 - i) * D;
    const score = Math.round(48 + 14 * Math.sin(i / 11) + 4 * Math.sin(i / 3));
    const fase = i < 20 ? 'correccion' : i < 38 ? 'acumulacion' : i < 60 ? 'recuperacion' : 'expansion-temprana';
    return { day: day(t), at: iso(t), score, confianza: 'alta', cobertura: 100, fase, bloques: {}, precio: 70000 + i * 100 };
  }),
}, [src('historial')]);

// Amplitud desde 2017 con tres altseasons: ene 2018, primavera de 2021 y dic 2024.
const amplitudDesde = Date.parse('2017-05-30T00:00:00Z');
const joroba = (t, centro, ancho) => Math.exp(-(((t - Date.parse(centro)) / (ancho * D)) ** 2));
const amplitudPct = Array.from({ length: Math.floor((now - amplitudDesde) / D) }, (_, i) => {
  const t = amplitudDesde + i * D;
  const v = 30 + 62 * Math.max(joroba(t, '2018-01-05', 25), joroba(t, '2021-04-20', 40), joroba(t, '2024-12-05', 15)) + 6 * Math.sin(i / 9);
  return Math.max(0, Math.min(100, Math.round(v)));
});
export const amplitud = env({
  desde: '2017-05-30',
  pct: amplitudPct,
  activos: { inicio: 12, fin: 29 },
  periodos: [
    { desde: '2017-12-14', hasta: '2018-01-27', maximo: 92, enCurso: false },
    { desde: '2021-03-18', hasta: '2021-05-24', maximo: 91, enCurso: false },
    { desde: '2024-11-28', hasta: '2024-12-14', maximo: 88, enCurso: false },
  ],
  source: 'coinmetrics',
}, [src('coinmetrics:altcoins')]);

export function route(page) {
  let tick = 0;
  const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  return page.route('**/api/**', (r) => {
    const u = r.request().url();
    if (u.includes('/api/dashboard')) return json(r, dashboard);
    if (u.includes('/api/orderbook')) return json(r, orderbook);
    if (u.includes('/api/market')) return json(r, marketHistory);
    if (u.includes('/api/altseason')) return json(r, altseason);
    if (u.includes('/api/network')) return json(r, network);
    if (u.includes('/api/onchain')) return json(r, onchain);
    if (u.includes('/api/precios')) {
      const k = ++tick;
      const syms = SYMS;
      const prices = { BTC: price * (1 - 0.01 * k), ETH: 0.033 * price };
      syms.forEach((sy, i) => { prices[sy] = (i === 18 ? 0.0000123 : i === 2 ? 2.4712 : 100 - i * 4.5) * (1 + 0.01 * k); });
      prices.TON = 0.0001; // otra moneda con el mismo símbolo: debe ignorarse
      return json(r, env({ prices, source: 'okx' }, [src('precios:okx')]));
    }
    if (u.includes('/api/alertas')) return json(r, env({ configured: true, publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' }));
    if (u.includes('/api/historial?serie=amplitud')) return json(r, amplitud);
    if (u.includes('/api/historial')) return json(r, historial);
    return json(r, { ok: true, data: null, meta: { generatedAt: iso(now), sources: [] } });
  });
}
