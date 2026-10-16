import { describe, expect, it } from 'vitest';
import { TRAMOS, esExtremo, limitarScore, posicion, tramoDe } from './TermometroCristal';
import { riesgoDe, scoreLabel } from '@/lib/score/opportunityScore';

const ETIQUETA: Record<string, string> = {
  'Muy favorable': 'Contexto muy favorable',
  Favorable: 'Contexto favorable',
  Equilibrado: 'Contexto equilibrado',
  Exigente: 'Contexto exigente',
  Riesgo: 'Contexto de riesgo elevado',
};

describe('termómetro de oportunidad', () => {
  it('marca el riesgo: 0 es muy favorable (azul) y 100 riesgo máximo (rojo)', () => {
    expect(riesgoDe(100)).toBe(0);
    expect(riesgoDe(0)).toBe(100);
    expect(TRAMOS[0]!.nombre).toBe('Muy favorable');
    expect(TRAMOS[TRAMOS.length - 1]!.nombre).toBe('Riesgo');
  });

  it('el tramo que marca es siempre el de la etiqueta del score', () => {
    // Antes la escala se repartía en partes iguales y no coincidía con la etiqueta.
    for (let s = 0; s <= 100; s += 0.5) {
      expect(ETIQUETA[tramoDe(riesgoDe(s)).nombre]).toBe(scoreLabel(s));
    }
    // Cubren 0-100 sin huecos.
    TRAMOS.forEach((t, i) => i > 0 && expect(t.desde).toBe(TRAMOS[i - 1]!.hasta));
    expect(TRAMOS[0]!.desde).toBe(0);
    expect(TRAMOS[TRAMOS.length - 1]!.hasta).toBe(100);
  });

  it('cada valor cae en su tramo, con los cortes en el tramo más favorable', () => {
    expect(tramoDe(0).nombre).toBe('Muy favorable');
    expect(tramoDe(20).nombre).toBe('Muy favorable');
    expect(tramoDe(20.5).nombre).toBe('Favorable');
    expect(tramoDe(38).nombre).toBe('Equilibrado');
    expect(tramoDe(65).nombre).toBe('Exigente');
    expect(tramoDe(65.1).nombre).toBe('Riesgo');
    expect(tramoDe(100).nombre).toBe('Riesgo');
  });

  it('solo brilla entero en los tramos de los extremos', () => {
    expect(TRAMOS.filter(esExtremo).map((t) => t.nombre)).toEqual(['Muy favorable', 'Riesgo']);
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
