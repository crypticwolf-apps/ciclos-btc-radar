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


describe('formatMoney · agrupación de miles', () => {
  it('agrupa también las cifras de cuatro dígitos', () => {
    // En la tabla de ciclos convivían «2791 €» y «13.810 €» en la misma columna.
    // Intl separa el símbolo con espacio duro: se normaliza para no depender de él.
    const plano = (v: number) => formatMoney(v, 'eur').replace(/ /g, ' ');
    expect(plano(2791)).toBe('2.791 €');
    expect(plano(13810)).toBe('13.810 €');
  });

  it('la notación compacta no lleva separador', () => {
    expect(formatMoney(2_500_000, 'eur', { compact: true })).not.toContain('.');
  });
});
