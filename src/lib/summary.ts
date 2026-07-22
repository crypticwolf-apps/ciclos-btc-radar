import type { MarketData } from '@/types';
import type { Currency } from '@/types/market';
import { formatPercent } from './format';
import { formatMoneyFromUsd } from './currency';

// Genera un resumen de texto plano del estado del mercado para "copiar".
export function buildMarketSummary(data: MarketData, currency: Currency, usdToEur: number): string {
  const { bitcoin, indicators, fase, opportunity, halvingInfo } = data;
  const money = (value: number) => formatMoneyFromUsd(value, currency, usdToEur);
  return [
    '📊 RESUMEN DE MERCADO · CICLOS BTC',
    '',
    `Precio BTC: ${money(bitcoin.precio)} (${formatPercent(bitcoin.cambio24h)} 24h)`,
    `Drawdown desde ATH: ${formatPercent(bitcoin.drawdownDesdeAth)} (ATH ${money(bitcoin.ath)})`,
    `Días desde el ATH: ${bitcoin.diasDesdeAth}`,
    `RSI (14d): ${indicators.rsi}`,
    `Fear & Greed: ${indicators.fearGreed} (${indicators.fearGreedLabel})`,
    `Fase del ciclo: ${fase.emoji} ${fase.nombre}`,
    `Días desde el halving: ${halvingInfo.diasDesdeUltimoHalving}`,
    '',
    `Score de oportunidad: ${opportunity.score}/100 — ${opportunity.etiqueta}`,
    '',
    '⚠️ No es consejo financiero. Datos con fines educativos.',
    `Fuente: ${data.source === 'live' ? 'datos en vivo' : 'datos simulados'} · ${new Date(
      data.lastUpdated,
    ).toLocaleString('es-ES')}`,
  ].join('\n');
}
