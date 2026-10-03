import type {
  BitcoinSnapshot,
  CyclePhase,
  CyclePhaseId,
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

/**
 * Información del ciclo de halving (días, próximo halving, bloques).
 *
 * Con la lista vacía devuelve huecos en lugar de reventar: si el proveedor del
 * histórico no responde, antes se leía `halvings[-1].fecha` sobre un `undefined`
 * y se caía el panel ENTERO, precio incluido.
 */
export function getHalvingCycleInfo(halvings: HalvingData[]): HalvingCycleInfo {
  // Solo halvings que YA han ocurrido: el histórico incluye al final el del
  // ciclo en curso, con fecha estimada, y contarlo como «último halving» haría
  // los días desde el halving negativos.
  const ocurridos = halvings.filter((h) => !h.halvingEstimado);
  const ultimoHalving = ocurridos[ocurridos.length - 1];
  if (!ultimoHalving) {
    return {
      ultimoHalving: null,
      diasDesdeUltimoHalving: null,
      proximoHalvingEstimado: null,
      diasHastaProximoHalving: null,
      bloquesRestantes: null,
    };
  }
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

const fmtPct = (v: number) => `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`;

/**
 * Determina la fase del ciclo con los datos de AHORA y explica por qué.
 *
 * Las reglas van de mayor a menor severidad y la primera que se cumple decide.
 * Una regla solo se evalúa si tiene TODOS sus datos: un indicador que falta no
 * puede disparar ni bloquear una fase. Antes se sustituía por un valor
 * «neutro» —RSI 50, caída 0%— y una caída desconocida contaba como «estamos en
 * máximos», lo que podía empujar la fase hacia expansión sin motivo.
 *
 * Devuelve la fase del catálogo más el MOTIVO y los datos que la han decidido,
 * para que la pantalla pueda enseñar en qué se basa y cambie sola en cuanto
 * cambien los datos.
 */
export function detectPhase(args: {
  bitcoin: BitcoinSnapshot;
  indicators: MarketIndicators;
}): CyclePhase {
  const { bitcoin, indicators } = args;
  const dd = bitcoin.drawdownDesdeAth; // negativo, o null si no hay ATH
  const { tendencia, rsi, fearGreed } = indicators;

  const criterios: { label: string; valor: string }[] = [
    { label: 'Desde el ATH', valor: dd == null ? 'sin dato' : fmtPct(dd) },
    { label: 'Tendencia', valor: tendencia ?? 'sin dato' },
    { label: 'RSI 14 d', valor: rsi == null ? 'sin dato' : String(Math.round(rsi)) },
    { label: 'Fear & Greed', valor: fearGreed == null ? 'sin dato' : String(fearGreed) },
  ];

  let id: CyclePhaseId;
  let motivo: string;

  if (rsi != null && fearGreed != null && dd != null && rsi < 30 && fearGreed <= 15 && dd < -35) {
    id = 'capitulacion';
    motivo = `Pánico extremo: RSI en sobreventa (${Math.round(rsi)}), miedo extremo (${fearGreed}) y una caída de ${fmtPct(dd)} desde el máximo.`;
  } else if (dd != null && dd < -25 && tendencia === 'bajista') {
    id = 'correccion';
    motivo = `Caída de ${fmtPct(dd)} desde el máximo, más del 25%, con la tendencia todavía bajista.`;
  } else if (dd != null && rsi != null && dd < -15 && rsi < 45 && tendencia != null && tendencia !== 'bajista') {
    id = 'recuperacion';
    motivo = `Tras una caída de ${fmtPct(dd)}, la tendencia ya no es bajista (${tendencia}) y el RSI (${Math.round(rsi)}) aún no se ha recalentado.`;
  } else if (dd != null && fearGreed != null && rsi != null && dd > -10 && fearGreed >= 75 && rsi > 70) {
    id = 'euforia';
    motivo = `A menos de un 10% del máximo (${fmtPct(dd)}) con codicia extrema (${fearGreed}) y RSI en sobrecompra (${Math.round(rsi)}).`;
  } else if (dd != null && dd > -10 && tendencia === 'alcista') {
    id = 'expansion-avanzada';
    motivo = `Tendencia alcista y precio a menos de un 10% del máximo (${fmtPct(dd)}).`;
  } else if (tendencia === 'alcista') {
    id = 'expansion-temprana';
    motivo = `Tendencia alcista${dd == null ? '' : `, aún a ${fmtPct(dd)} del máximo`}: el precio recupera terreno sin euforia.`;
  } else {
    id = 'acumulacion';
    motivo =
      tendencia == null && dd == null
        ? 'Faltan la tendencia y el máximo histórico: sin ellos no se puede afirmar una fase más concreta.'
        : `Ninguna señal de corrección, recuperación ni expansión: tendencia ${tendencia ?? 'sin dato'}${dd == null ? '' : ` y precio a ${fmtPct(dd)} del máximo`}.`;
  }

  return { ...PHASES[id], motivo, criterios };
}
