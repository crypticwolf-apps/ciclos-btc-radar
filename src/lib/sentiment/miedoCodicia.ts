// =============================================================================
// Zonas del índice de miedo y codicia (alternative.me, 0-100).
//
// Los cortes son los que publica el índice: miedo extremo hasta 25, miedo hasta
// 45, neutral hasta 55, codicia hasta 75 y codicia extrema por encima. Las
// fuentes no coinciden al punto en los bordes de la zona neutral, así que, si
// llega la etiqueta del propio índice («Miedo», «Codicia»…), manda ella: la zona
// encendida, el color y la palabra que se ven son siempre los mismos.
// =============================================================================

export interface ZonaMiedoCodicia {
  nombre: string;
  desde: number;
  hasta: number;
  color: string;
  claro: string;
  oscuro: string;
}

export const ZONAS_MIEDO_CODICIA: readonly ZonaMiedoCodicia[] = [
  { nombre: 'Miedo extremo', desde: 0, hasta: 25, color: '#ff2d3f', claro: '#ff9ba6', oscuro: '#8a0016' },
  { nombre: 'Miedo', desde: 25, hasta: 45, color: '#ff8a00', claro: '#ffc680', oscuro: '#8f4a00' },
  { nombre: 'Neutral', desde: 45, hasta: 55, color: '#ffd60a', claro: '#fff08a', oscuro: '#8a6d00' },
  { nombre: 'Codicia', desde: 55, hasta: 75, color: '#8ee63a', claro: '#cdf7a0', oscuro: '#3f7a0c' },
  { nombre: 'Codicia extrema', desde: 75, hasta: 100, color: '#16e07a', claro: '#8ff5c0', oscuro: '#06703b' },
];

/**
 * Índice de la zona de un valor. La etiqueta del índice, si llega y se reconoce,
 * manda sobre los cortes; si no, cada corte va con la zona de arriba (25 ya es
 * «miedo», no «miedo extremo»).
 */
export function zonaMiedoCodicia(valor: number, etiqueta?: string | null): number {
  const porNombre = etiqueta
    ? ZONAS_MIEDO_CODICIA.findIndex((z) => z.nombre.toLowerCase() === etiqueta.trim().toLowerCase())
    : -1;
  if (porNombre >= 0) return porNombre;
  const v = Math.max(0, Math.min(100, Number.isFinite(valor) ? valor : 50));
  const i = ZONAS_MIEDO_CODICIA.findIndex((z) => v < z.hasta);
  return i >= 0 ? i : ZONAS_MIEDO_CODICIA.length - 1;
}
