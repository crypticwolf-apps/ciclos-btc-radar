import type {
  BitcoinSnapshot,
  CyclePhase,
  CyclePhaseId,
  EtfSummary,
  HalvingCycleInfo,
  HalvingData,
  MarketIndicators,
} from '@/types';
import { PHASES } from '@/data/phases';

// =============================================================================
// SERVICIO: Detección de fase del ciclo + score de oportunidad
// -----------------------------------------------------------------------------
// Lógica determinista (sin IA) basada en reglas sobre:
//   días desde el halving, drawdown, RSI, Fear & Greed, tendencia,
//   flujos de ETFs y comportamiento de ballenas.
// Todo es transparente y auditable para el usuario.
// =============================================================================

const BLOCKS_PER_HALVING = 210_000;
const AVG_BLOCK_MINUTES = 10;

/** Calcula la información del ciclo de halving (días, próximo halving, bloques). */
export function getHalvingCycleInfo(halvings: HalvingData[]): HalvingCycleInfo {
  const ultimoHalving = halvings[halvings.length - 1];
  const last = new Date(ultimoHalving.fecha).getTime();
  const now = Date.now();
  const diasDesdeUltimoHalving = Math.round((now - last) / 86_400_000);

  // Próximo halving ≈ 4 años (1458 días) tras el anterior.
  const ciclomMs = BLOCKS_PER_HALVING * AVG_BLOCK_MINUTES * 60 * 1000;
  const proximo = new Date(last + ciclomMs);
  const diasHastaProximoHalving = Math.max(
    0,
    Math.round((proximo.getTime() - now) / 86_400_000),
  );
  const bloquesRestantes = Math.max(
    0,
    Math.round((diasHastaProximoHalving * 24 * 60) / AVG_BLOCK_MINUTES),
  );

  return {
    ultimoHalving,
    diasDesdeUltimoHalving,
    proximoHalvingEstimado: proximo.toISOString(),
    diasHastaProximoHalving,
    bloquesRestantes,
  };
}

/**
 * Determina la fase aproximada del ciclo combinando varias señales.
 * Las reglas están ordenadas de mayor a menor severidad.
 */
export function detectPhase(args: {
  bitcoin: BitcoinSnapshot;
  indicators: MarketIndicators;
  halvingInfo: HalvingCycleInfo;
  etf: EtfSummary;
}): CyclePhase {
  const { bitcoin, indicators } = args;
  const dd = bitcoin.drawdownDesdeAth; // negativo
  const { rsi, fearGreed, tendencia } = indicators;

  let id: CyclePhaseId;

  if (rsi < 30 && fearGreed <= 15 && dd < -35) {
    // Pánico extremo con sobreventa profunda.
    id = 'capitulacion';
  } else if (dd < -25 && tendencia === 'bajista') {
    // Caída relevante desde máximos, tendencia aún a la baja.
    id = 'correccion';
  } else if (dd < -15 && rsi < 45 && tendencia !== 'bajista') {
    // Estabilización tras la caída, momentum recuperándose.
    id = 'recuperacion';
  } else if (dd > -10 && fearGreed >= 75 && rsi > 70) {
    // Cerca del máximo con codicia extrema.
    id = 'euforia';
  } else if (dd > -10 && tendencia === 'alcista') {
    id = 'expansion-avanzada';
  } else if (tendencia === 'alcista') {
    id = 'expansion-temprana';
  } else {
    id = 'acumulacion';
  }

  return PHASES[id];
}
