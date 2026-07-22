import { describe, expect, it } from 'vitest';
import {
  convertFromUsd,
  formatMoney,
  formatMoneyFromUsd,
  isValidExchangeRate,
} from './currency';

describe('moneda global', () => {
  it('convierte cantidades USD completas al tipo EUR indicado', () => {
    expect(convertFromUsd(100, 'eur', 0.92)).toBe(92);
    expect(convertFromUsd(100, 'usd', 0.92)).toBe(100);
  });

  it('formatea con Intl y la divisa elegida', () => {
    expect(formatMoney(1234, 'eur')).toContain('€');
    expect(formatMoneyFromUsd(100, 'eur', 0.9)).toContain('90');
  });

  it('rechaza tipos de cambio corruptos o inverosímiles', () => {
    expect(isValidExchangeRate(0.92)).toBe(true);
    expect(isValidExchangeRate(0)).toBe(false);
    expect(isValidExchangeRate(Number.NaN)).toBe(false);
  });
});

