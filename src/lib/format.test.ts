import { describe, it, expect } from 'vitest';
import { formatGainPct } from './format';

describe('formatGainPct', () => {
  it('agrupa los miles también en cifras de cuatro dígitos', () => {
    // Sin esto, un +2021% se lee como un año en la tabla de ciclos.
    expect(formatGainPct(2021)).toBe('+2.021%');
    expect(formatGainPct(692)).toBe('+692%');
    expect(formatGainPct(11082)).toBe('+11.082%');
    expect(formatGainPct(53814)).toBe('+53.814%');
  });

  it('no antepone signo a los valores negativos ni al cero', () => {
    expect(formatGainPct(-45)).toBe('-45%');
    expect(formatGainPct(0)).toBe('0%');
  });

  it('devuelve un guion ante valores no finitos', () => {
    expect(formatGainPct(Number.NaN)).toBe('—');
    expect(formatGainPct(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
