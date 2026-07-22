import { describe, expect, it } from 'vitest';
import { downsamplePricePoints } from './downsample';

describe('downsamplePricePoints', () => {
  it('preserves the first, last, global minimum and global maximum', () => {
    const points = Array.from({ length: 5_000 }, (_, index) => ({
      t: index,
      price: index === 1_234 ? 1 : index === 3_456 ? 999_999 : 10_000 + index,
    }));
    const sampled = downsamplePricePoints(points, 900);

    expect(sampled.length).toBeLessThanOrEqual(900);
    expect(sampled[0]).toEqual(points[0]);
    expect(sampled[sampled.length - 1]).toEqual(points[points.length - 1]);
    expect(sampled).toContainEqual(points[1_234]);
    expect(sampled).toContainEqual(points[3_456]);
    expect(sampled.every((point, index) => index === 0 || point.t >= sampled[index - 1]!.t)).toBe(true);
  });
});
