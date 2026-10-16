import { describe, expect, it } from 'vitest';
import { FASES_RUEDA, ORDEN_FASES, anguloFase } from './RuedaFase';
import { PHASES } from '@/data/phases';

describe('rueda de la fase del ciclo', () => {
  it('tiene las siete fases, cada una una vez, en el orden del ciclo', () => {
    expect(new Set(ORDEN_FASES)).toEqual(new Set(Object.keys(PHASES)));
    expect(ORDEN_FASES).toHaveLength(Object.keys(PHASES).length);
    // Arriba la acumulación; la recuperación cierra la vuelta antes de volver a ella.
    expect(ORDEN_FASES[0]).toBe('acumulacion');
    expect(ORDEN_FASES[ORDEN_FASES.length - 1]).toBe('recuperacion');
  });

  it('reparte la vuelta entera en tramos iguales, con el color de cada fase', () => {
    const paso = 360 / ORDEN_FASES.length;
    FASES_RUEDA.forEach((f, i) => {
      expect(f.angulo).toBeCloseTo(i * paso);
      expect(f.color).toBe(PHASES[f.id].color);
    });
  });

  it('la esfera va en el centro del tramo, en el sentido del reloj', () => {
    expect(anguloFase('acumulacion')).toBe(0);
    expect(anguloFase('correccion')).toBeGreaterThan(anguloFase('euforia'));
    expect(anguloFase('recuperacion')).toBeLessThan(360);
  });
});
