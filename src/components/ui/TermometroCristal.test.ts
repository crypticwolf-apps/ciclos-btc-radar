import { describe, expect, it } from 'vitest';
import { TRAMOS, limitarScore, posicion, tramoDe } from './TermometroCristal';
import { scoreLabel } from '@/lib/score/opportunityScore';

describe('termómetro de oportunidad', () => {
  it('los tramos son los del propio score: cada uno, una etiqueta distinta', () => {
    // Antes la escala se repartía en partes iguales y no coincidía con la etiqueta.
    for (const t of TRAMOS) {
      expect(scoreLabel(t.desde)).toBe(scoreLabel(t.hasta - 0.01));
    }
    expect(new Set(TRAMOS.map((t) => scoreLabel(t.desde))).size).toBe(TRAMOS.length);
    // Cubren 0-100 sin huecos.
    TRAMOS.forEach((t, i) => i > 0 && expect(t.desde).toBe(TRAMOS[i - 1]!.hasta));
    expect(TRAMOS[0]!.desde).toBe(0);
    expect(TRAMOS[TRAMOS.length - 1]!.hasta).toBe(100);
  });

  it('cada valor cae en su tramo, con los cortes en el tramo de arriba', () => {
    expect(tramoDe(34.9).nombre).toBe('Riesgo');
    expect(tramoDe(35).nombre).toBe('Exigente');
    expect(tramoDe(62).nombre).toBe('Equilibrado');
    expect(tramoDe(80).nombre).toBe('Muy favorable');
    expect(tramoDe(100).nombre).toBe('Muy favorable');
  });

  it('el líquido nunca se sale del tubo', () => {
    expect(limitarScore(-20)).toBe(0);
    expect(limitarScore(140)).toBe(100);
    expect(limitarScore(Number.NaN)).toBe(0);
    expect(posicion(-5)).toBe(posicion(0));
    expect(posicion(150)).toBe(posicion(100));
    expect(posicion(50)).toBeGreaterThan(posicion(35));
  });
});
