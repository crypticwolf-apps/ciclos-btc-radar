import { describe, it, expect } from 'vitest';
import { detectPhase } from './cycleDetector';
import type { BitcoinSnapshot, MarketIndicators } from '@/types';

// La fase NO es un texto fijo: sale de los datos de ahora. Estos casos fijan
// que cambia cuando cambian los datos y que un dato que falta no la decide.

function btc(drawdownDesdeAth: number | null): BitcoinSnapshot {
  return {
    precio: 80_000,
    cambio24h: 0,
    ath: drawdownDesdeAth == null ? null : 120_000,
    athFecha: null,
    drawdownDesdeAth,
    diasDesdeAth: null,
    recuperacionNecesaria: null,
    actualizado: '',
  };
}
function ind(p: Partial<MarketIndicators>): MarketIndicators {
  return { rsi: 50, fearGreed: 50, fearGreedLabel: null, tendencia: 'lateral', actualizado: '', ...p };
}

describe('fase del ciclo', () => {
  it.each([
    ['capitulacion', -60, { rsi: 22, fearGreed: 9, tendencia: 'bajista' }],
    ['correccion', -40, { tendencia: 'bajista' }],
    ['recuperacion', -30, { rsi: 40, tendencia: 'lateral' }],
    ['euforia', -3, { rsi: 78, fearGreed: 85, tendencia: 'alcista' }],
    ['expansion-avanzada', -6, { tendencia: 'alcista' }],
    ['expansion-temprana', -30, { rsi: 55, tendencia: 'alcista' }],
    ['acumulacion', -40, { rsi: 55, tendencia: 'lateral' }],
  ] as const)('%s', (fase, dd, extra) => {
    const r = detectPhase({ bitcoin: btc(dd), indicators: ind(extra) });
    expect(r.id).toBe(fase);
    // Siempre explica en qué se basa, con las cifras.
    expect(r.motivo).toBeTruthy();
    expect(r.criterios?.find((c) => c.label === 'Desde el ATH')?.valor).toContain(String(dd));
  });

  it('cambia sola cuando cambian los datos', () => {
    const antes = detectPhase({ bitcoin: btc(-40), indicators: ind({ tendencia: 'bajista' }) });
    const despues = detectPhase({ bitcoin: btc(-40), indicators: ind({ tendencia: 'alcista' }) });
    expect(antes.id).toBe('correccion');
    expect(despues.id).toBe('expansion-temprana');
    expect(antes.color).not.toBe(despues.color);
  });

  it('sin máximo histórico no se da por hecho que estamos en máximos', () => {
    // Antes la caída desconocida contaba como 0% y con tendencia alcista salía
    // «expansión avanzada» (a menos de un 10% del máximo).
    const r = detectPhase({ bitcoin: btc(null), indicators: ind({ tendencia: 'alcista' }) });
    expect(r.id).toBe('expansion-temprana');
    expect(r.criterios?.find((c) => c.label === 'Desde el ATH')?.valor).toBe('sin dato');
  });

  it('sin RSI ni sentimiento no se dispara la capitulación', () => {
    const r = detectPhase({
      bitcoin: btc(-70),
      indicators: ind({ rsi: null, fearGreed: null, tendencia: 'lateral' }),
    });
    expect(r.id).not.toBe('capitulacion');
  });
});
