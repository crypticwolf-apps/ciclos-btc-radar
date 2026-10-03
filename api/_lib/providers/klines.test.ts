import { describe, expect, it } from 'vitest';
import { mapPool } from './klines.js';

describe('peticiones por tandas', () => {
  it('nunca hay más de `limit` a la vez y devuelve en orden', async () => {
    let enCurso = 0;
    let maximo = 0;
    const r = await mapPool(Array.from({ length: 40 }, (_, i) => i), 12, async (i) => {
      enCurso++;
      maximo = Math.max(maximo, enCurso);
      await new Promise((res) => setTimeout(res, 5));
      enCurso--;
      return i * 2;
    });
    expect(maximo).toBeLessThanOrEqual(12);
    expect(r.map((x) => (x.status === 'fulfilled' ? x.value : null))).toEqual(Array.from({ length: 40 }, (_, i) => i * 2));
  });

  it('reintenta una vez las que fallan (un 429 por ráfaga)', async () => {
    const intentos = new Map<number, number>();
    const r = await mapPool([1, 2, 3], 2, async (i) => {
      const n = (intentos.get(i) ?? 0) + 1;
      intentos.set(i, n);
      if (i === 2 && n === 1) throw new Error('429');
      if (i === 3) throw new Error('no existe');
      return i;
    }, 1);
    expect(r[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(r[1]).toEqual({ status: 'fulfilled', value: 2 });
    expect(r[2]!.status).toBe('rejected');
    expect(intentos.get(3)).toBe(2);
  });
});
