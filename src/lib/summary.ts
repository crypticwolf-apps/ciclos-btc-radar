import type { MarketData } from '@/types';
import { formatPercent, formatUsd } from './format';

// Genera un resumen de texto plano del estado del mercado para "copiar".
export function buildMarketSummary(data: MarketData): string {
  const { bitcoin, indicators, fase, opportunity, halvingInfo } = data;
  return [
    '📊 RESUMEN DE MERCADO · CICLOS BTC',
    '',
    `Precio BTC: ${formatUsd(bitcoin.precio)} (${formatPercent(bitcoin.cambio24h)} 24h)`,
    `Drawdown desde ATH: ${formatPercent(bitcoin.drawdownDesdeAth)} (ATH ${formatUsd(bitcoin.ath)})`,
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
