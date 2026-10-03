import type { CyclePhaseId } from '../../types/index.js';

// =============================================================================
// Reglas de la fase del ciclo de Bitcoin.
//
// Módulo sin dependencias de la interfaz porque lo usan dos sitios: la app
// (services/cycleDetector.ts, que añade el texto de la fase) y el servidor, que
// guarda la fase de cada día para el histórico. Imports relativos con .js: lo
// ejecuta Node en las funciones serverless.
//
// Las reglas van de mayor a menor severidad y la primera que se cumple decide.
// Una regla solo se evalúa si tiene TODOS sus datos: un indicador que falta no
// puede disparar ni bloquear una fase.
// =============================================================================

export interface PhaseInputs {
  /** Caída desde el máximo histórico, en % (negativo), o null si no se sabe. */
  dd: number | null;
  tendencia: 'alcista' | 'bajista' | 'lateral' | null;
  rsi: number | null;
  fearGreed: number | null;
}

const fmtPct = (v: number) => `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`;

export function phaseRule({ dd, tendencia, rsi, fearGreed }: PhaseInputs): { id: CyclePhaseId; motivo: string } {
  if (rsi != null && fearGreed != null && dd != null && rsi < 30 && fearGreed <= 15 && dd < -35) {
    return {
      id: 'capitulacion',
      motivo: `Pánico extremo: RSI en sobreventa (${Math.round(rsi)}), miedo extremo (${fearGreed}) y una caída de ${fmtPct(dd)} desde el máximo.`,
    };
  }
  if (dd != null && dd < -25 && tendencia === 'bajista') {
    return {
      id: 'correccion',
      motivo: `Caída de ${fmtPct(dd)} desde el máximo, más del 25%, con la tendencia todavía bajista.`,
    };
  }
  if (dd != null && rsi != null && dd < -15 && rsi < 45 && tendencia != null && tendencia !== 'bajista') {
    return {
      id: 'recuperacion',
      motivo: `Tras una caída de ${fmtPct(dd)}, la tendencia ya no es bajista (${tendencia}) y el RSI (${Math.round(rsi)}) aún no se ha recalentado.`,
    };
  }
  if (dd != null && fearGreed != null && rsi != null && dd > -10 && fearGreed >= 75 && rsi > 70) {
    return {
      id: 'euforia',
      motivo: `A menos de un 10% del máximo (${fmtPct(dd)}) con codicia extrema (${fearGreed}) y RSI en sobrecompra (${Math.round(rsi)}).`,
    };
  }
  if (dd != null && dd > -10 && tendencia === 'alcista') {
    return { id: 'expansion-avanzada', motivo: `Tendencia alcista y precio a menos de un 10% del máximo (${fmtPct(dd)}).` };
  }
  if (tendencia === 'alcista') {
    return {
      id: 'expansion-temprana',
      motivo: `Tendencia alcista${dd == null ? '' : `, aún a ${fmtPct(dd)} del máximo`}: el precio recupera terreno sin euforia.`,
    };
  }
  return {
    id: 'acumulacion',
    motivo:
      tendencia == null && dd == null
        ? 'Faltan la tendencia y el máximo histórico: sin ellos no se puede afirmar una fase más concreta.'
        : `Ninguna señal de corrección, recuperación ni expansión: tendencia ${tendencia ?? 'sin dato'}${dd == null ? '' : ` y precio a ${fmtPct(dd)} del máximo`}.`,
  };
}
