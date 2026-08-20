import { describe, it, expect } from 'vitest';
import { computeHalving, difficultyFromBits } from './mempool.js';

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
