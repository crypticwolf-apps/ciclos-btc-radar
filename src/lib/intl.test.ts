import { describe, expect, it } from 'vitest';
import { fechaEs, numeroEs } from './intl';

describe('formateadores reutilizados', () => {
  it('con las mismas opciones, el mismo formateador', () => {
    expect(numeroEs({ maximumFractionDigits: 1 })).toBe(numeroEs({ maximumFractionDigits: 1 }));
    expect(fechaEs({ month: 'short', year: 'numeric' })).toBe(fechaEs({ month: 'short', year: 'numeric' }));
    expect(numeroEs({ maximumFractionDigits: 1 })).not.toBe(numeroEs({ maximumFractionDigits: 2 }));
  });

  it('escriben lo mismo que un formateador nuevo', () => {
    const opciones: Intl.NumberFormatOptions = { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 };
    expect(numeroEs(opciones).format(67424.4)).toBe(new Intl.NumberFormat('es-ES', opciones).format(67424.4));
    const fecha = new Date(Date.UTC(2026, 10, 23));
    expect(fechaEs({ dateStyle: 'medium', timeZone: 'UTC' }).format(fecha)).toBe(
      new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'UTC' }).format(fecha),
    );
  });
});
