import { describe, expect, it } from 'vitest';
import { snapshotHace, type DailySnapshot } from './snapshot';

const dia = (day: string, score: number) => ({ day, score }) as DailySnapshot;

describe('score de hace N días', () => {
  const days = [dia('2026-10-01', 40), dia('2026-10-05', 45), dia('2026-10-09', 50), dia('2026-10-16', 62)];

  it('el de hace 7 días exactos, o el más cercano anterior', () => {
    expect(snapshotHace(days, 7)?.score).toBe(50); // 9 de octubre
    expect(snapshotHace(days, 10)?.score).toBe(45); // no hay del 6: el del 5
  });

  it('sin histórico suficiente, nada', () => {
    expect(snapshotHace(days, 30)).toBeNull();
    expect(snapshotHace([], 7)).toBeNull();
  });
});
