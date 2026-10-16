import { describe, it, expect } from 'vitest';
import { computeHalving, difficultyFromBits, minutesPerBlockSince } from './mempool.js';

describe('computeHalving', () => {
  it('en el bloque exacto del halving el progreso es 0', () => {
    const h = computeHalving(840_000);
    expect(h.lastHalvingBlock).toBe(840_000);
    expect(h.nextHalvingBlock).toBe(1_050_000);
    expect(h.blocksRemaining).toBe(210_000);
    expect(h.progress).toBe(0);
  });

  it('a mitad de intervalo el progreso es ~0.5', () => {
    const h = computeHalving(945_000);
    expect(h.progress).toBe(0.5);
    expect(h.blocksRemaining).toBe(105_000);
  });

  it('estima la fecha del próximo halving en el futuro', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const h = computeHalving(900_000, now);
    expect(new Date(h.estimatedDate).getTime()).toBeGreaterThan(now);
  });
});

describe('fecha del próximo halving con el ritmo real de bloques', () => {
  const HALVING_2024 = Date.parse('2024-04-20T00:09:27Z');
  const MIN = 60_000;

  it('usa el ritmo medido desde el último halving, no 10 minutos fijos', () => {
    // 100.000 bloques a 9,8 minutos desde el halving de 2024.
    const now = HALVING_2024 + 100_000 * 9.8 * MIN;
    const h = computeHalving(940_000, now);
    expect(h.minutesPerBlock).toBeCloseTo(9.8, 2);
    expect(Date.parse(h.estimatedDate)).toBeCloseTo(now + 110_000 * 9.8 * MIN, -4);
    // Con 10 minutos fijos saldría unos 15 días más tarde.
    expect((now + 110_000 * 10 * MIN - Date.parse(h.estimatedDate)) / 86_400_000).toBeCloseTo(15.3, 0);
  });

  it('justo después de un halving, con pocos bloques, se queda en 10 minutos', () => {
    expect(minutesPerBlockSince(840_000, 841_000, HALVING_2024 + 1_000 * 9 * MIN)).toBe(10);
  });

  it('sin la fecha de ese halving o con un ritmo absurdo, también 10 minutos', () => {
    expect(minutesPerBlockSince(1_050_000, 1_060_000, Date.parse('2029-01-01T00:00:00Z'))).toBe(10);
    // Reloj desfasado: 20 minutos por bloque no es un ritmo real.
    expect(minutesPerBlockSince(840_000, 850_000, HALVING_2024 + 10_000 * 20 * MIN)).toBe(10);
  });
});

describe('difficultyFromBits', () => {
  it('el objetivo del bloque génesis (0x1d00ffff) es dificultad 1', () => {
    expect(difficultyFromBits(0x1d00ffff)).toBeCloseTo(1, 6);
  });

  it('un objetivo más pequeño da más dificultad', () => {
    // 0x170331db es un `bits` real de 2024: dificultad del orden de 8·10^13.
    const d = difficultyFromBits(0x170331db);
    expect(d).toBeGreaterThan(1e13);
    expect(d).toBeLessThan(1e15);
  });

  it('rechaza un exponente imposible en vez de devolver un número absurdo', () => {
    expect(() => difficultyFromBits(0x0100ffff)).toThrow();
  });
});
