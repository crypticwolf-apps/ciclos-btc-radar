import { describe, expect, it } from 'vitest';
import { direccionVisible } from './useCambioVisible';

describe('color del precio en vivo', () => {
  const antes = { valor: 78_000.12, texto: '78.000 $' };

  it('céntimos que no cambian la cifra visible no dan color', () => {
    expect(direccionVisible(antes, 78_000.4, '78.000 $')).toBeNull();
    expect(direccionVisible(antes, 77_999.9, '78.000 $')).toBeNull();
  });

  it('si la cifra visible sube o baja, verde o rojo', () => {
    expect(direccionVisible(antes, 78_001.2, '78.001 $')).toBe('up');
    expect(direccionVisible(antes, 77_998.7, '77.999 $')).toBe('down');
  });

  it('cambiar de moneda cambia el texto pero no es subida ni bajada', () => {
    expect(direccionVisible(antes, 78_000.12, '72.000 €')).toBe('flat');
  });

  it('el primer precio no tiene con qué compararse', () => {
    expect(direccionVisible(null, 78_000, '78.000 $')).toBeNull();
  });
});
