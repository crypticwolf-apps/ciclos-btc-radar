import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LateError, withDeadline } from './deadline.js';

describe('tope de espera por fuente', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const tras = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

  it('a tiempo: devuelve el dato', async () => {
    const p = withDeadline(tras(100, 'ok'), 1_000, 'X');
    await vi.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBe('ok');
  });

  it('tarde: no espera más del tope y lo marca como tardío', async () => {
    const p = withDeadline(tras(5_000, 'ok'), 1_000, 'FRED');
    const r = expect(p).rejects.toBeInstanceOf(LateError);
    await vi.advanceTimersByTimeAsync(1_000);
    await r;
  });

  it('un fallo de la fuente se propaga tal cual', async () => {
    const p = withDeadline(Promise.reject(new Error('caída')), 1_000, 'X');
    await expect(p).rejects.toThrow('caída');
  });
});
