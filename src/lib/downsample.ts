import type { PricePoint } from '@/types/market';

/**
 * Reduce una serie para dibujarla sin perder el primer punto, el último ni los
 * máximos/mínimos de cada tramo. Las métricas siempre deben calcularse sobre la
 * serie original, no sobre este resultado.
 */
export function downsamplePricePoints(points: PricePoint[], maxPoints = 900): PricePoint[] {
  if (points.length <= maxPoints || maxPoints < 4) return points;

  const interior = points.slice(1, -1);
  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const bucketSize = Math.ceil(interior.length / bucketCount);
  const sampled: PricePoint[] = [points[0]!];

  for (let start = 0; start < interior.length; start += bucketSize) {
    const bucket = interior.slice(start, start + bucketSize);
    if (bucket.length === 0) continue;
    let minIndex = 0;
    let maxIndex = 0;
    for (let index = 1; index < bucket.length; index += 1) {
      if (bucket[index]!.price < bucket[minIndex]!.price) minIndex = index;
      if (bucket[index]!.price > bucket[maxIndex]!.price) maxIndex = index;
    }
    if (minIndex === maxIndex) sampled.push(bucket[minIndex]!);
    else if (minIndex < maxIndex) sampled.push(bucket[minIndex]!, bucket[maxIndex]!);
    else sampled.push(bucket[maxIndex]!, bucket[minIndex]!);
  }

  sampled.push(points[points.length - 1]!);
  return sampled;
}
