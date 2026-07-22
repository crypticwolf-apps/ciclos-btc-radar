import type {
  BitcoinSnapshot,
  CyclePhase,
  CyclePhaseId,
  EtfSummary,
  HalvingCycleInfo,
  HalvingData,
  MacroSnapshot,
  MarketIndicators,
  MarketSignal,
  OpportunityScore,
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

// --- Score de oportunidad (0-100) -------------------------------------------

interface ScoreInputs {
  bitcoin: BitcoinSnapshot;
  indicators: MarketIndicators;
  etf: EtfSummary;
  macro: MacroSnapshot;
  whaleAccumulating: boolean;
}

/**
 * Construye un score 0-100 donde 0 = máximo riesgo y 100 = oportunidad
 * histórica. Cada señal aporta un peso explicable que se muestra en la UI.
 */
export function computeOpportunityScore(inputs: ScoreInputs): OpportunityScore {
  const { bitcoin, indicators, etf, macro, whaleAccumulating } = inputs;
  const senales: MarketSignal[] = [];

  // Punto de partida neutral.
  let score = 50;

  // 1) Drawdown desde ATH: cuanto más profundo, más oportunidad a largo plazo.
  const dd = bitcoin.drawdownDesdeAth;
  if (dd < -50) {
    score += 16;
    senales.push(sig('dd', 'Caída profunda desde el ATH', `${dd.toFixed(0)}% desde máximos`, 'positivo', 16, 'precio'));
  } else if (dd < -30) {
    score += 11;
    senales.push(sig('dd', 'Corrección significativa', `${dd.toFixed(0)}% desde el ATH`, 'positivo', 11, 'precio'));
  } else if (dd < -15) {
    score += 5;
    senales.push(sig('dd', 'Retroceso saludable', `${dd.toFixed(0)}% desde el ATH`, 'positivo', 5, 'precio'));
  } else if (dd > -5) {
    score -= 10;
    senales.push(sig('dd', 'Precio cerca de máximos', `${dd.toFixed(0)}% desde el ATH`, 'negativo', -10, 'precio'));
  }

  // 2) RSI.
  if (indicators.rsi < 30) {
    score += 14;
    senales.push(sig('rsi', 'RSI en sobreventa', `RSI ${indicators.rsi}`, 'positivo', 14, 'momentum'));
  } else if (indicators.rsi > 70) {
    score -= 12;
    senales.push(sig('rsi', 'RSI sobrecomprado', `RSI ${indicators.rsi}`, 'negativo', -12, 'momentum'));
  } else {
    senales.push(sig('rsi', 'RSI en zona neutral', `RSI ${indicators.rsi}`, 'neutral', 0, 'momentum'));
  }

  // 3) Fear & Greed.
  if (indicators.fearGreed <= 20) {
    score += 13;
    senales.push(sig('fng', 'Miedo extremo en el mercado', `F&G ${indicators.fearGreed}`, 'positivo', 13, 'sentimiento'));
  } else if (indicators.fearGreed >= 80) {
    score -= 13;
    senales.push(sig('fng', 'Codicia extrema', `F&G ${indicators.fearGreed}`, 'negativo', -13, 'sentimiento'));
  } else {
    senales.push(sig('fng', 'Sentimiento equilibrado', `F&G ${indicators.fearGreed}`, 'neutral', 0, 'sentimiento'));
  }

  // 4) Comportamiento institucional / ballenas.
  if (whaleAccumulating) {
    score += 8;
    senales.push(sig('whale', 'Ballenas acumulando', 'Las direcciones grandes aumentan su balance', 'positivo', 8, 'institucional'));
  }
  if (etf.inflowsRecientes > 0) {
    score += 5;
    senales.push(sig('etf', 'ETFs con entradas netas', 'Entradas netas recientes', 'positivo', 5, 'institucional'));
  } else {
    score -= 5;
    senales.push(sig('etf', 'ETFs con salidas netas', 'Salidas netas recientes', 'negativo', -5, 'institucional'));
  }

  // 5) Macro (ISM > 50 = expansión).
  if (macro.ismActual >= 50) {
    score += 7;
    senales.push(sig('ism', 'Economía en expansión', `ISM ${macro.ismActual}`, 'positivo', 7, 'macro'));
  } else {
    score -= 4;
    senales.push(sig('ism', 'Economía en contracción', `ISM ${macro.ismActual}`, 'negativo', -4, 'macro'));
  }

  // 6) Tendencia de precio.
  if (indicators.tendencia === 'alcista') {
    score += 4;
    senales.push(sig('trend', 'Tendencia alcista', 'Estructura de precio al alza', 'positivo', 4, 'precio'));
  } else if (indicators.tendencia === 'bajista') {
    score -= 4;
    senales.push(sig('trend', 'Tendencia bajista', 'Estructura de precio a la baja', 'negativo', -4, 'precio'));
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    etiqueta: scoreLabel(score),
    resumen: scoreSummary(score),
    senales: senales.sort((a, b) => Math.abs(b.peso) - Math.abs(a.peso)),
  };
}

function sig(
  id: string,
  label: string,
  detalle: string,
  tipo: MarketSignal['tipo'],
  peso: number,
  categoria: MarketSignal['categoria'],
): MarketSignal {
  return { id, label, detalle, tipo, peso, categoria };
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Oportunidad histórica';
  if (score >= 65) return 'Zona de oportunidad';
  if (score >= 50) return 'Contexto favorable';
  if (score >= 35) return 'Precaución';
  return 'Riesgo elevado';
}

function scoreSummary(score: number): string {
  if (score >= 80)
    return 'Múltiples señales de miedo extremo coinciden con acumulación institucional y mejora macro. Históricamente, contextos así han sido zonas de oportunidad asimétrica.';
  if (score >= 65)
    return 'Varias señales apuntan a una zona de valor, aunque persisten riesgos. El miedo y la sobreventa suelen acompañar a buenas zonas de acumulación.';
  if (score >= 50)
    return 'El balance de señales es ligeramente favorable. Conviene seguir vigilando momentum, sentimiento y flujos institucionales.';
  if (score >= 35)
    return 'El contexto invita a la prudencia: algunas señales de riesgo pesan sobre las oportunidades. Gestión de riesgo recomendada.';
  return 'Predominan las señales de riesgo (euforia, sobrecompra o salidas institucionales). Históricamente, zonas para extremar la cautela.';
}

export function scoreColor(score: number): string {
  if (score >= 65) return '#22c55e';
  if (score >= 50) return '#84cc16';
  if (score >= 35) return '#f59e0b';
  return '#ef4444';
}
