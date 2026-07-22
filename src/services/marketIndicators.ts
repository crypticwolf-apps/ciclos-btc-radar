// =============================================================================
// Clasificación del índice de miedo y codicia en zonas de sentimiento.
//
// El resto de este módulo (petición directa a alternative.me y cálculo de RSI y
// tendencia en el navegador) se ha retirado: esos datos los sirve el backend
// desde `/api/dashboard`, ya validados con Zod y con cache compartida. Tenerlos
// también aquí significaba dos implementaciones del mismo cálculo que podían
// dar resultados distintos.
// =============================================================================

/** Clasifica un valor de Fear & Greed (0-100) en su zona de sentimiento. */
export function fearGreedZone(value: number): { label: string; color: string } {
  if (value <= 20) return { label: 'Miedo extremo', color: '#b91c1c' };
  if (value <= 40) return { label: 'Miedo', color: '#ef4444' };
  if (value <= 60) return { label: 'Neutral', color: '#94a3b8' };
  if (value <= 80) return { label: 'Codicia', color: '#22c55e' };
  return { label: 'Codicia extrema', color: '#16a34a' };
}
