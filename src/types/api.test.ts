import { describe, it, expect } from 'vitest';
import { statusLabel, isUsable } from './api';

describe('helpers de estado de dato', () => {
  it('statusLabel traduce cada estado', () => {
    expect(statusLabel('live')).toBe('En vivo');
    expect(statusLabel('cached')).toBe('Cacheado');
    expect(statusLabel('stale')).toBe('Retrasado');
    expect(statusLabel('locked')).toBe('Requiere proveedor');
    expect(statusLabel('unavailable')).toBe('No disponible');
  });

  it('isUsable solo es cierto para datos con valor', () => {
    expect(isUsable('live')).toBe(true);
    expect(isUsable('cached')).toBe(true);
    expect(isUsable('stale')).toBe(true);
    expect(isUsable('locked')).toBe(false);
    expect(isUsable('unavailable')).toBe(false);
  });
});
