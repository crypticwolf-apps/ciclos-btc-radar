import { describe, expect, it } from 'vitest';
import { derivePhaseHistory } from './phaseHistory.js';
import { PHASE_FROM_CODE } from '../../../src/lib/cycle/phaseRule.js';

const DAY = 86_400_000;
const T0 = Date.parse('2018-01-01T00:00:00Z');

/** Sube 200 días hasta 20.000, cae 150 días un 60% y se queda plano. */
function serie() {
  const out: { t: number; price: number }[] = [];
  for (let i = 0; i < 450; i++) {
    const p = i < 200 ? 5_000 + i * 75 : i < 350 ? 20_000 * (1 - ((i - 200) / 150) * 0.6) : 8_000;
    out.push({ t: T0 + i * DAY, price: p });
  }
  return out;
}

describe('fase del ciclo reconstruida', () => {
  const fng = Array.from({ length: 450 }, (_, i) => ({ t: T0 + i * DAY, value: i < 200 ? 85 : i < 350 ? 10 : 40 }));
  const h = derivePhaseHistory(serie(), fng);
  const fase = (i: number) => PHASE_FROM_CODE[h.fases[i - 30]!];

  it('una letra y un precio por día, seguidos desde el primer día con datos', () => {
    expect(h.desde).toBe('2018-01-31');
    expect(h.fases.length).toBe(h.precios.length);
    expect(h.fases.length).toBe(450 - 30);
  });

  it('aplica las mismas reglas que la fase de hoy', () => {
    // Subiendo en máximos con codicia: expansión avanzada o euforia.
    expect(['expansion-avanzada', 'euforia']).toContain(fase(150));
    // Cayendo más del 25% con tendencia bajista: corrección o capitulación.
    expect(['correccion', 'capitulacion']).toContain(fase(330));
    // Plano tras la caída: la tendencia deja de ser bajista con el RSI frío.
    expect(fase(440)).toBe('recuperacion');
  });

  it('un día sin dato repite el cierre anterior en vez de dejar un hueco', () => {
    const conHueco = serie().filter((_, i) => i !== 100);
    const g = derivePhaseHistory(conHueco, fng);
    expect(g.fases.length).toBe(h.fases.length);
    expect(g.precios[100 - 30]).toBe(g.precios[99 - 30]);
  });
});
