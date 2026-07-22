import type {
  BitcoinSnapshot,
  CycleComparison,
  CyclePricePoint,
  DrawdownEvent,
  EtfFlowPoint,
  FearGreedEvent,
  HalvingData,
  IsmPoint,
  MacroIndicator,
  MarketIndicators,
  RsiBottom,
  SmartMoneyEvent,
  WhaleTimelinePoint,
  YearlyLow,
} from '@/types';

// =============================================================================
// DATOS MOCK
// -----------------------------------------------------------------------------
// Estos datos sirven como:
//   1) Estado inicial mientras cargan las APIs reales.
//   2) Fallback si una API falla.
// Las series históricas son fijas; las métricas "vivas" (precio, RSI, F&G...)
// se sobrescriben en services/* cuando hay conexión real.
// =============================================================================

/** Snapshot vivo de Bitcoin (se reemplaza por CoinGecko u otra API). */
export const MOCK_BITCOIN: BitcoinSnapshot = {
  precio: 70000,
  cambio24h: -3.2,
  ath: 126000,
  athFecha: '2025-10-06',
  drawdownDesdeAth: -44.4,
  diasDesdeAth: 247,
  recuperacionNecesaria: 80,
  minimoAnual: 76329,
  maximoAnual: 126000,
  actualizado: new Date().toISOString(),
};

export const MOCK_INDICATORS: MarketIndicators = {
  rsi: 25.6,
  fearGreed: 5,
  fearGreedLabel: 'Miedo extremo',
  tendencia: 'bajista',
  actualizado: new Date().toISOString(),
};

// --- Series históricas (estables) -------------------------------------------

/**
 * Respaldo del histórico de halvings, SOLO para cuando Coin Metrics no responde.
 * En condiciones normales estos datos se derivan de la serie diaria real (ver
 * `getHalvingHistory`), así que esta tabla no debería llegar a mostrarse.
 *
 * Las alturas de bloque, las fechas y las recompensas son hechos de la cadena.
 * Los precios son cierres diarios reales, redondeados.
 */
export const MOCK_HALVINGS: HalvingData[] = [
  { year: '2012', fecha: '2012-11-28T15:24:38Z', block: '210.000', reward: '25 BTC', priceAtHalving: 12, picoPost: 1135, picoFecha: '2013-12-04T00:00:00Z', retornoPct: 9103, ventanaAbierta: false },
  { year: '2016', fecha: '2016-07-09T16:46:13Z', block: '420.000', reward: '12,5 BTC', priceAtHalving: 652, picoPost: 19641, picoFecha: '2017-12-16T00:00:00Z', retornoPct: 2913, ventanaAbierta: false },
  { year: '2020', fecha: '2020-05-11T19:23:43Z', block: '630.000', reward: '6,25 BTC', priceAtHalving: 8592, picoPost: 67542, picoFecha: '2021-11-08T00:00:00Z', retornoPct: 686, ventanaAbierta: false },
  { year: '2024', fecha: '2024-04-20T00:09:27Z', block: '840.000', reward: '3,125 BTC', priceAtHalving: 64908, picoPost: 124824, picoFecha: '2025-10-06T00:00:00Z', retornoPct: 92, ventanaAbierta: false },
];

export const MOCK_CYCLE_PRICES: CyclePricePoint[] = [
  { year: '2010', price: 0.1, cycle: 1, phase: 'inicio' },
  { year: '2011 Pico', price: 31, cycle: 1, phase: 'máximo', isPeak: true },
  { year: '2011 Suelo', price: 2, cycle: 1, phase: 'mínimo', isBottom: true },
  { year: '2012', price: 5, cycle: 2, phase: 'acumulación' },
  { year: '2013 Pico', price: 1150, cycle: 2, phase: 'máximo', isPeak: true },
  { year: '2015 Suelo', price: 200, cycle: 2, phase: 'mínimo', isBottom: true },
  { year: '2016', price: 400, cycle: 3, phase: 'acumulación' },
  { year: '2017 Pico', price: 19800, cycle: 3, phase: 'máximo', isPeak: true },
  { year: '2018 Suelo', price: 3200, cycle: 3, phase: 'mínimo', isBottom: true },
  { year: '2019', price: 4000, cycle: 4, phase: 'acumulación' },
  { year: '2021 Pico', price: 69000, cycle: 4, phase: 'máximo', isPeak: true },
  { year: '2022 Suelo', price: 15500, cycle: 4, phase: 'mínimo', isBottom: true },
  { year: '2023', price: 25000, cycle: 5, phase: 'acumulación' },
  { year: '2024', price: 70000, cycle: 5, phase: 'expansión' },
  { year: '2025 Pico', price: 126000, cycle: 5, phase: 'máximo', isPeak: true },
  { year: 'Actual', price: 70000, cycle: 5, phase: 'corrección', isCurrent: true },
];

export const MOCK_CYCLE_COMPARISON: CycleComparison[] = [
  { cycle: 'Ciclo 1\n(2010-11)', min: 0.1, max: 31, growth: 31000, color: '#3b82f6' },
  { cycle: 'Ciclo 2\n(2012-15)', min: 2, max: 1150, growth: 57400, color: '#8b5cf6' },
  { cycle: 'Ciclo 3\n(2016-18)', min: 200, max: 19800, growth: 9800, color: '#ec4899' },
  { cycle: 'Ciclo 4\n(2019-22)', min: 3200, max: 69000, growth: 2056, color: '#f59e0b' },
  { cycle: 'Ciclo 5\n(2023-??)', min: 15500, max: 126000, growth: 713, color: '#22c55e', current: true },
];

export const MOCK_DRAWDOWNS: DrawdownEvent[] = [
  { period: '2011', drawdown: -93, recovery: 12804 },
  { period: '2013-15', drawdown: -85, recovery: 8900 },
  { period: '2017-18', drawdown: -84, recovery: 1600 },
  { period: '2021-22', drawdown: -78, recovery: 716 },
  { period: 'Actual', drawdown: -44, recovery: null, current: true },
];

export const MOCK_YEARLY_LOWS: YearlyLow[] = [
  { year: '2016', low: 366 },
  { year: '2017', low: 788 },
  { year: '2018', low: 3185 },
  { year: '2019', low: 3359 },
  { year: '2020', low: 4959 },
  { year: '2021', low: 29381 },
  { year: '2022', low: 15758 },
  { year: '2023', low: 16607 },
  { year: '2024', low: 39447 },
  { year: '2025', low: 76329 },
];

export const MOCK_SMART_MONEY: SmartMoneyEvent[] = [
  { event: 'COVID Mar 2020', whales: 85, retail: -45, priceChange: -50 },
  { event: 'May 2021', whales: 60, retail: -30, priceChange: -35 },
  { event: 'FTX Nov 2022', whales: 70, retail: -55, priceChange: -25 },
  { event: 'Ago 2024', whales: 40, retail: -20, priceChange: -20 },
  { event: 'Corrección actual', whales: 95, retail: -60, priceChange: -44, current: true },
];

export const MOCK_WHALE_TIMELINE: WhaleTimelinePoint[] = [
  { period: 'Pico Oct 25', whaleBalance: 100, retailBalance: 100, price: 126 },
  { period: 'Nov 25', whaleBalance: 102, retailBalance: 95, price: 105 },
  { period: 'Dic 25', whaleBalance: 105, retailBalance: 88, price: 90 },
  { period: 'Ene 26', whaleBalance: 110, retailBalance: 80, price: 82 },
  { period: 'Feb 26', whaleBalance: 118, retailBalance: 72, price: 68 },
  { period: 'Actual', whaleBalance: 125, retailBalance: 65, price: 70, current: true },
];

export const MOCK_RSI_BOTTOMS: RsiBottom[] = [
  { event: '2015', rsi: 28, return1Y: 225 },
  { event: '2018', rsi: 27, return1Y: 150 },
  { event: 'COVID 2020', rsi: 32, return1Y: 1060 },
  { event: 'Actual', rsi: 25.6, return1Y: null, current: true },
];

export const MOCK_FEAR_GREED_HISTORY: FearGreedEvent[] = [
  { event: 'Mt. Gox 2014', value: 9 },
  { event: 'COVID 2020', value: 8 },
  { event: 'FTX 2022', value: 12 },
  { event: 'Actual', value: 5, highlight: true },
];

export const MOCK_ETF_FLOWS: EtfFlowPoint[] = [
  { month: 'Ene 24', cumulative: 1.5, monthly: 1.5 },
  { month: 'Feb 24', cumulative: 6.0, monthly: 4.5 },
  { month: 'Mar 24', cumulative: 12.0, monthly: 6.0 },
  { month: 'Abr 24', cumulative: 11.5, monthly: -0.5 },
  { month: 'May 24', cumulative: 13.5, monthly: 2.0 },
  { month: 'Jun 24', cumulative: 15.0, monthly: 1.5 },
  { month: 'Jul 24', cumulative: 17.5, monthly: 2.5 },
  { month: 'Ago 24', cumulative: 18.0, monthly: 0.5 },
  { month: 'Sep 24', cumulative: 18.5, monthly: 0.5 },
  { month: 'Oct 24', cumulative: 22.0, monthly: 3.5 },
  { month: 'Nov 24', cumulative: 30.0, monthly: 8.0 },
  { month: 'Dic 24', cumulative: 35.5, monthly: 5.5 },
  { month: 'Ene 25', cumulative: 40.0, monthly: 4.5 },
  { month: 'Feb 25', cumulative: 44.0, monthly: 4.0 },
  { month: 'Mar 25', cumulative: 48.0, monthly: 4.0 },
  { month: 'Abr 25', cumulative: 50.0, monthly: 2.0 },
  { month: 'May 25', cumulative: 52.0, monthly: 2.0 },
  { month: 'Jun 25', cumulative: 54.0, monthly: 2.0 },
  { month: 'Jul 25', cumulative: 57.0, monthly: 3.0 },
  { month: 'Ago 25', cumulative: 59.0, monthly: 2.0 },
  { month: 'Sep 25', cumulative: 60.0, monthly: 1.0 },
  { month: 'Oct 25', cumulative: 58.5, monthly: -1.5, correction: true },
  { month: 'Nov 25', cumulative: 55.0, monthly: -3.5, correction: true },
  { month: 'Dic 25', cumulative: 54.0, monthly: -1.0, correction: true },
  { month: 'Ene 26', cumulative: 52.5, monthly: -1.5, correction: true },
  { month: 'Feb 26', cumulative: 52.3, monthly: -0.2, recovery: true },
  { month: 'Actual', cumulative: 54.0, monthly: 1.7, recovery: true },
];

export const MOCK_ISM: IsmPoint[] = [
  { period: '2021 Q1', value: 64.7 }, { period: '2021 Q2', value: 60.6 },
  { period: '2021 Q3', value: 59.9 }, { period: '2021 Q4', value: 58.7 },
  { period: '2022 Q1', value: 57.1 }, { period: '2022 Q2', value: 53.0 },
  { period: '2022 Q3', value: 52.8 }, { period: '2022 Q4', value: 49.0 },
  { period: '2023 Q1', value: 47.7 }, { period: '2023 Q2', value: 46.4 },
  { period: '2023 Q3', value: 47.6 }, { period: '2023 Q4', value: 47.1 },
  { period: '2024 Q1', value: 47.8 }, { period: '2024 Q2', value: 48.5 },
  { period: '2024 Q3', value: 47.2 }, { period: '2024 Q4', value: 48.4 },
  { period: '2025 Q1', value: 48.0 }, { period: '2025 Q2', value: 48.7 },
  { period: '2025 Q3', value: 49.2 }, { period: '2025 Q4', value: 47.9 },
  { period: 'Actual', value: 52.5, current: true },
];

export const MOCK_MACRO_INDICATORS: MacroIndicator[] = [
  {
    id: 'liquidez',
    nombre: 'Liquidez global',
    valor: 'Expandiéndose',
    estado: 'positivo',
    descripcion: 'La masa monetaria global (M2) creciente suele favorecer a los activos de riesgo como Bitcoin.',
    icono: 'Droplets',
  },
  {
    id: 'tipos',
    nombre: 'Tipos de interés',
    valor: 'A la baja',
    estado: 'positivo',
    descripcion: 'Recortes de tipos abaratan el dinero y aumentan el apetito por activos de mayor riesgo.',
    icono: 'Percent',
  },
  {
    id: 'dolar',
    nombre: 'Dólar (DXY)',
    valor: 'Debilitándose',
    estado: 'positivo',
    descripcion: 'Un dólar más débil históricamente coincide con fuerza en Bitcoin y materias primas.',
    icono: 'DollarSign',
  },
  {
    id: 'inflacion',
    nombre: 'Inflación',
    valor: 'Moderándose',
    estado: 'neutral',
    descripcion: 'Inflación controlada da margen a los bancos centrales para mantener políticas laxas.',
    icono: 'TrendingUp',
  },
  {
    id: 'riesgo',
    nombre: 'Apetito por riesgo',
    valor: 'Cauto',
    estado: 'neutral',
    descripcion: 'El sentimiento de mercado es prudente; aún no hay euforia generalizada en activos de riesgo.',
    icono: 'Gauge',
  },
];

// --- Métricas resumen reutilizables -----------------------------------------

export const MOCK_ETF_SUMMARY = {
  inflowsTotales: 57,
  aumTotal: 114,
  correccionReciente: -6,
  inflowsRecientes: 1.7,
};
