import { describe, expect, it } from 'vitest';
import { arcPath, clampScore, scoreToNeedlePoint } from './RiskOpportunityScore';

// El centro y el radio de la cinta viven en el componente; aquí se comprueban
// las propiedades geométricas, no coordenadas concretas: así el test sigue
// valiendo si la aguja se alarga o el arco se engorda, y solo falla si la punta
// se sale de donde debe estar.
const CENTER = { x: 120, y: 112 };
const RIBBON_RADIUS = 96;
const RIBBON_HALF_WIDTH = 6.5; // trazo de 13

const distanceFromCenter = (p: { x: number; y: number }) =>
  Math.hypot(p.x - CENTER.x, p.y - CENTER.y);

describe('termómetro de oportunidad', () => {
  it.each([0, 10, 50, 90, 100])('mantiene la punta de %s dentro de la cinta', (score) => {
    const point = scoreToNeedlePoint(score);
    const radius = distanceFromCenter(point);
    // Ni tan corta que no se lea, ni tan larga que invada el arco de color.
    expect(radius).toBeGreaterThan(RIBBON_RADIUS * 0.6);
    expect(radius).toBeLessThanOrEqual(RIBBON_RADIUS - RIBBON_HALF_WIDTH);
    // Semicírculo superior: la aguja nunca baja del eje.
    expect(point.y).toBeLessThanOrEqual(CENTER.y + 0.0001);
  });

  it('limita valores fuera de 0-100', () => {
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(120)).toBe(100);
  });

  it('sitúa 0 a la izquierda, 50 arriba y 100 a la derecha', () => {
    const min = scoreToNeedlePoint(0);
    const mid = scoreToNeedlePoint(50);
    const max = scoreToNeedlePoint(100);

    expect(min.x).toBeLessThan(CENTER.x);
    expect(min.y).toBeCloseTo(CENTER.y);
    expect(mid.x).toBeCloseTo(CENTER.x);
    expect(mid.y).toBeLessThan(CENTER.y);
    expect(max.x).toBeGreaterThan(CENTER.x);
    expect(max.y).toBeCloseTo(CENTER.y);
  });

  describe('arco del recorrido', () => {
    it('empieza a la izquierda y termina donde marca el score', () => {
      // «M x y A rx ry rotación arco-largo sentido x y» → nueve números.
      const [startX, startY, , , , , , endX, endY] = arcPath(0, 50)
        .replace(/[MA]/g, ' ')
        .trim()
        .split(/\s+/)
        .map(Number);

      expect(startX).toBeCloseTo(CENTER.x - RIBBON_RADIUS);
      expect(startY).toBeCloseTo(CENTER.y);
      // A mitad de recorrido la punta del arco está justo encima del centro.
      expect(endX).toBeCloseTo(CENTER.x);
      expect(endY).toBeCloseTo(CENTER.y - RIBBON_RADIUS);
    });

    it('nunca pide el arco largo: el medidor solo abarca media circunferencia', () => {
      // El cuarto parámetro del comando A es large-arc-flag. Con 1, el navegador
      // dibuja el tramo por el otro lado del círculo y el arco iluminado se sale
      // del medidor. Ningún recorrido de 0-100 supera los 180°.
      for (const to of [10, 40, 55, 80, 100]) {
        expect(arcPath(0, to).split('A')[1]!.trim().split(/\s+/)[3]).toBe('0');
      }
    });
  });
});
