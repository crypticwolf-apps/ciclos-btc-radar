import { describe, expect, it } from 'vitest';
import { monedaEncendida, posicionAltseason } from './AltseasonGauge';
import { altseasonZoneIndex, ALTSEASON_ZONES } from '@/lib/altseason/score';
import { CLASSIFICATIONS } from '@/lib/altseason/config';

describe('barra del Altseason Score', () => {
  it('la escala va de moneda a moneda y el líquido no se sale', () => {
    expect(posicionAltseason(0)).toBe(posicionAltseason(-10));
    expect(posicionAltseason(100)).toBe(posicionAltseason(140));
    expect(posicionAltseason(Number.NaN)).toBe(posicionAltseason(0));
    expect(posicionAltseason(50)).toBeCloseTo((posicionAltseason(0) + posicionAltseason(100)) / 2);
  });

  it('brilla la moneda de Bitcoin en su zona y la de Ethereum en la euforia', () => {
    expect(monedaEncendida(0)).toBe('btc');
    expect(monedaEncendida(20)).toBe('btc');
    expect(monedaEncendida(21)).toBeNull();
    expect(monedaEncendida(80)).toBeNull();
    expect(monedaEncendida(81)).toBe('eth');
    expect(monedaEncendida(100)).toBe('eth');
    expect(monedaEncendida(null)).toBeNull();
  });

  it('un score de 0 cae en la zona de Bitcoin (antes no marcaba ninguna)', () => {
    expect(altseasonZoneIndex(0)).toBe(0);
    expect(altseasonZoneIndex(100)).toBe(ALTSEASON_ZONES.length - 1);
  });

  it('una zona por clasificación, empezando por el naranja de Bitcoin', () => {
    expect(ALTSEASON_ZONES).toHaveLength(CLASSIFICATIONS.length);
    expect(ALTSEASON_ZONES[0]).toMatchObject({ label: 'Bitcoin', color: '#f7931a' });
  });
});
