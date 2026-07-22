import { describe, expect, it } from 'vitest';
import { clampScore, scoreToNeedlePoint } from './RiskOpportunityScore';

describe('termómetro de oportunidad', () => {
  it.each([0, 10, 50, 90, 100])('mantiene %s dentro del arco', (score) => {
    const point = scoreToNeedlePoint(score);
    expect(point.x).toBeGreaterThanOrEqual(48);
    expect(point.x).toBeLessThanOrEqual(192);
    expect(point.y).toBeGreaterThanOrEqual(40);
    expect(point.y).toBeLessThanOrEqual(112.0001);
  });

  it('limita valores fuera de 0-100', () => {
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(120)).toBe(100);
  });

  it('sitúa 0 a la izquierda, 50 arriba y 100 a la derecha', () => {
    expect(scoreToNeedlePoint(0).x).toBeCloseTo(48);
    expect(scoreToNeedlePoint(50).y).toBeCloseTo(40);
    expect(scoreToNeedlePoint(100).x).toBeCloseTo(192);
  });
});
