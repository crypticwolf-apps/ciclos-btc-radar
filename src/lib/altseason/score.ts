import {
  CLASSIFICATIONS,
  COMPONENTS,
  CONFIDENCE_RULES,
  DATA_REQUIREMENTS,
  PENALTIES,
  PHASES,
  THRESHOLDS,
  classify,
  type ComponentId,
  type PhaseId,
  // Extensión .js explícita: este módulo lo cargan también las funciones
  // serverless, y Node en modo ESM exige la extensión en runtime.
} from './config.js';

// =============================================================================
// ALTSEASON SCORE (0-100)
// -----------------------------------------------------------------------------
// Mismo principio que el Score de Oportunidad: componentes ponderados, un
// componente sin datos vale `null` (NO cero) y su peso se redistribuye entre
// los disponibles, bajando la confianza declarada.
//
// Toda la parametrización vive en `config.ts`. Aquí solo está la mecánica.
// El score describe la ROTACIÓN del mercado; no predice precios ni recomienda.
// =============================================================================

const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));

/** Lleva un valor a 0-100 interpolando entre los extremos configurados. */
export function normalize(value: number, at0: number, at100: number): number {
  if (!Number.isFinite(value) || at0 === at100) return 50;
  return clamp(((value - at0) / (at100 - at0)) * 100);
}

/** Métricas crudas que alimentan el score. `null` = no disponible. */
export interface AltseasonMetrics {
  /** % de altcoins que superan a BTC a 90 días. */
  outperform90Pct: number | null;
  outperform60Pct: number | null;
  outperform30Pct: number | null;
  /** Nº que superan y nº analizadas, para poder explicarlo. */
  outperformCount: number | null;
  analyzedCount: number;
  btcReturn90: number | null;

  /** Dominancia de BTC y su variación en puntos porcentuales. */
  btcDominance: number | null;
  dominanceChange24h: number | null;
  dominanceChange7d: number | null;
  dominanceChange30d: number | null;

  /** % de altcoins por encima de sus medias móviles. */
  aboveSma20Pct: number | null;
  aboveSma50Pct: number | null;
  aboveSma200Pct: number | null;
  positive7dPct: number | null;
  positive30dPct: number | null;
  positive90dPct: number | null;
  near90dHighCount: number | null;
  drawdown20PlusCount: number | null;

  /** ETH/BTC y variaciones en %. */
  ethBtc: number | null;
  ethBtcChange24h: number | null;
  ethBtcChange7d: number | null;
  ethBtcChange30d: number | null;
  ethBtcChange90d: number | null;

  /** Capitalización total y excluyendo BTC / BTC+ETH, en USD. */
  totalMarketCap: number | null;
  marketCapExBtc: number | null;
  marketCapExBtcEth: number | null;
  /** Crecimiento de la cap. sin BTC MENOS el de BTC, en pp a 30 días. */
  exBtcVsBtc30d: number | null;
  exBtcChange7d: number | null;
  exBtcChange30d: number | null;

  /** Cuota del volumen que va a altcoins (0-100). */
  altVolumeSharePct: number | null;
  btcVolumeUsd: number | null;
  altVolumeUsd: number | null;

  /** Riesgo. */
  avgAltVolatility: number | null;
  btcVolatility: number | null;
  /** Cuota del rendimiento total acaparada por las 5 mejores (0-1). */
  top5Concentration: number | null;
  avgDrawdownFromHigh: number | null;

  /** Liquidez en stablecoins. */
  stablecoinChange30d: number | null;
  stablecoinChange7d: number | null;

  /** Antigüedad del dato más viejo usado, en horas. */
  dataAgeHours: number | null;
  /** `true` si alguna fuente vino de caché en vez de fresca. */
  fromCache: boolean;
}

export interface ScoreComponent {
  id: ComponentId;
  label: string;
  /** 0-100, o `null` si falta el dato. */
  score: number | null;
  weight: number;
  /** Peso real tras redistribuir el de los componentes ausentes. */
  effectiveWeight: number;
  /** Valor crudo de la métrica, ya formateado. */
  rawValue: string;
  explanation: string;
}

export type Confidence = 'alta' | 'media' | 'baja';

export interface AltseasonSignal {
  text: string;
  /** Métrica que lo respalda, para poder auditarlo. */
  evidence: string;
}

export interface AltseasonResult {
  /** `null` si no hay datos suficientes: NUNCA se devuelve 0 por falta de datos. */
  score: number | null;
  /** Motivo por el que no se pudo calcular, si procede. */
  unavailableReason: string | null;
  classification: string;
  summary: string;
  phase: PhaseId;
  phaseLabel: string;
  confidence: Confidence;
  /** % del peso total que sí tiene datos. */
  coverage: number;
  componentsAvailable: number;
  componentsTotal: number;
  missing: string[];
  components: ScoreComponent[];
  signalsFor: AltseasonSignal[];
  signalsAgainst: AltseasonSignal[];
  /** Penalizaciones aplicadas, en puntos. */
  penalties: { reason: string; points: number }[];
  scenarios: {
    confirm: string[];
    continue: string[];
    invalidate: string[];
  };
}

/** Extrae de las métricas el valor crudo que alimenta cada componente. */
function rawFor(id: ComponentId, m: AltseasonMetrics): number | null {
  switch (id) {
    case 'outperformance':
      return m.outperform90Pct;
    case 'dominance':
      return m.dominanceChange30d;
    case 'breadth':
      return m.aboveSma50Pct;
    case 'ethbtc':
      return m.ethBtcChange30d;
    case 'marketExBtc':
      return m.exBtcVsBtc30d;
    case 'volume':
      return m.altVolumeSharePct;
    case 'stablecoins':
      return m.stablecoinChange30d;
    default:
      return null;
  }
}

function explain(id: ComponentId, value: number, m: AltseasonMetrics): string {
  switch (id) {
    case 'outperformance':
      return m.outperformCount != null
        ? `${m.outperformCount} de ${m.analyzedCount} altcoins superan a BTC a 90 días (${value.toFixed(0)}%).`
        : `${value.toFixed(0)}% de las altcoins superan a BTC a 90 días.`;
    case 'dominance':
      return value < 0
        ? `La dominancia de Bitcoin baja ${Math.abs(value).toFixed(2)} puntos en 30 días: el capital rota.`
        : `La dominancia de Bitcoin sube ${value.toFixed(2)} puntos en 30 días: el capital se concentra en BTC.`;
    case 'breadth':
      return `${value.toFixed(0)}% de las altcoins cotizan por encima de su media de 50 días.`;
    case 'ethbtc':
      return value >= 0
        ? `ETH/BTC sube ${value.toFixed(1)}% en 30 días.`
        : `ETH/BTC cae ${Math.abs(value).toFixed(1)}% en 30 días.`;
    case 'marketExBtc':
      return value >= 0
        ? `La capitalización sin BTC crece ${value.toFixed(1)} puntos más que Bitcoin en 30 días.`
        : `La capitalización sin BTC crece ${Math.abs(value).toFixed(1)} puntos menos que Bitcoin en 30 días.`;
    case 'volume':
      return `El ${value.toFixed(0)}% del volumen negociado va a altcoins.`;
    case 'stablecoins':
      return value >= 0
        ? `El capital en stablecoins crece ${value.toFixed(1)}% en 30 días.`
        : `El capital en stablecoins se contrae ${Math.abs(value).toFixed(1)}% en 30 días.`;
    default:
      return '';
  }
}

/** Decide la fase del ciclo de altcoins a partir de las señales combinadas. */
export function determinePhase(m: AltseasonMetrics, score: number): PhaseId {
  const out = m.outperform90Pct;
  const domUp = (m.dominanceChange30d ?? 0) > THRESHOLDS.dominanceTrend;
  const domDown = (m.dominanceChange30d ?? 0) < -THRESHOLDS.dominanceTrend;
  const ethUp = (m.ethBtcChange30d ?? 0) > THRESHOLDS.ethBtcTrend;
  const ethDown = (m.ethBtcChange30d ?? 0) < -THRESHOLDS.ethBtcTrend;
  const breadth = m.aboveSma50Pct;
  const hotVol = (m.avgAltVolatility ?? 0) > THRESHOLDS.volatilityExtreme;
  const concentrated = (m.top5Concentration ?? 0) > THRESHOLDS.concentrationHigh;

  // Euforia: rotación muy amplia + riesgo disparado.
  if (
    out != null &&
    out >= THRESHOLDS.outperformStrong &&
    hotVol &&
    (breadth ?? 0) >= THRESHOLDS.breadthHealthy
  ) {
    return 'euforia';
  }

  // Enfriamiento: la amplitud se cae y BTC recupera dominancia.
  if (domUp && (breadth ?? 100) < THRESHOLDS.breadthWeak && out != null && out < THRESHOLDS.outperformModerate) {
    return 'enfriamiento';
  }

  if (out != null && out >= THRESHOLDS.outperformStrong && domDown) return 'altseason-amplia';
  if (out != null && out >= THRESHOLDS.outperformModerate && !domUp) return 'expansion-grandes';
  if (ethUp && !domUp) return 'rotacion-eth';
  if (domUp || ethDown || (out != null && out < THRESHOLDS.outperformWeak)) return 'dominio-btc';

  // Sin extremos claros, la fase la marca el propio score.
  if (score >= 70) return 'altseason-amplia';
  if (score >= 50) return 'expansion-grandes';
  if (score >= 35) return 'rotacion-eth';
  if (concentrated) return 'enfriamiento';
  return 'dominio-btc';
}

/** Señales dinámicas, generadas solo si el dato real las respalda. */
function buildSignals(m: AltseasonMetrics): {
  signalsFor: AltseasonSignal[];
  signalsAgainst: AltseasonSignal[];
} {
  const forS: AltseasonSignal[] = [];
  const against: AltseasonSignal[] = [];

  if (m.dominanceChange30d != null) {
    if (m.dominanceChange30d < -THRESHOLDS.dominanceTrend) {
      forS.push({
        text: 'La dominancia de Bitcoin está descendiendo.',
        evidence: `${m.dominanceChange30d.toFixed(2)} pp en 30 días`,
      });
    } else if (m.dominanceChange30d > THRESHOLDS.dominanceTrend) {
      against.push({
        text: 'La dominancia de Bitcoin continúa subiendo.',
        evidence: `+${m.dominanceChange30d.toFixed(2)} pp en 30 días`,
      });
    }
  }

  if (m.outperform90Pct != null && m.outperformCount != null) {
    if (m.outperform90Pct >= THRESHOLDS.outperformStrong) {
      forS.push({
        text: `Más del ${THRESHOLDS.outperformStrong}% de las altcoins supera a BTC a 90 días.`,
        evidence: `${m.outperformCount} de ${m.analyzedCount}`,
      });
    } else if (m.outperform90Pct < THRESHOLDS.outperformWeak) {
      against.push({
        text: 'Muy pocas altcoins consiguen superar a Bitcoin.',
        evidence: `${m.outperformCount} de ${m.analyzedCount} a 90 días`,
      });
    }
  }

  if (m.ethBtcChange30d != null) {
    if (m.ethBtcChange30d > THRESHOLDS.ethBtcTrend) {
      forS.push({
        text: 'ETH/BTC está fortaleciendo su tendencia.',
        evidence: `+${m.ethBtcChange30d.toFixed(1)}% en 30 días`,
      });
    } else if (m.ethBtcChange30d < -THRESHOLDS.ethBtcTrend) {
      against.push({
        text: 'ETH/BTC sigue debilitándose.',
        evidence: `${m.ethBtcChange30d.toFixed(1)}% en 30 días`,
      });
    }
  }

  if (m.aboveSma50Pct != null) {
    if (m.aboveSma50Pct >= THRESHOLDS.breadthHealthy) {
      forS.push({
        text: 'La amplitud del mercado acompaña al movimiento.',
        evidence: `${m.aboveSma50Pct.toFixed(0)}% sobre su media de 50 días`,
      });
    } else if (m.aboveSma50Pct < THRESHOLDS.breadthWeak) {
      against.push({
        text: 'La mayoría de altcoins permanece bajo su media de 50 días.',
        evidence: `solo ${m.aboveSma50Pct.toFixed(0)}% por encima`,
      });
    }
  }

  if (m.exBtcVsBtc30d != null && m.exBtcVsBtc30d > 2) {
    forS.push({
      text: 'La capitalización sin Bitcoin crece más rápido que el propio Bitcoin.',
      evidence: `+${m.exBtcVsBtc30d.toFixed(1)} pp en 30 días`,
    });
  }

  if (m.altVolumeSharePct != null && m.altVolumeSharePct >= 65) {
    forS.push({
      text: 'El volumen se está trasladando hacia altcoins.',
      evidence: `${m.altVolumeSharePct.toFixed(0)}% del volumen total`,
    });
  } else if (m.altVolumeSharePct != null && m.altVolumeSharePct < 45) {
    against.push({
      text: 'El volumen no confirma el movimiento: sigue concentrado en Bitcoin.',
      evidence: `${m.altVolumeSharePct.toFixed(0)}% en altcoins`,
    });
  }

  if (m.top5Concentration != null && m.top5Concentration > THRESHOLDS.concentrationHigh) {
    against.push({
      text: 'El rendimiento está concentrado en muy pocas altcoins.',
      evidence: `las 5 mejores acaparan el ${(m.top5Concentration * 100).toFixed(0)}%`,
    });
  }

  if (m.avgAltVolatility != null && m.avgAltVolatility > THRESHOLDS.volatilityExtreme) {
    against.push({
      text: 'La volatilidad es excesiva y aumenta el riesgo de vaivenes bruscos.',
      evidence: `${m.avgAltVolatility.toFixed(0)}% anualizada`,
    });
  }

  return { signalsFor: forS, signalsAgainst: against };
}

/** Escenarios expresados como condiciones, nunca como predicción de precio. */
function buildScenarios(m: AltseasonMetrics, phase: PhaseId): AltseasonResult['scenarios'] {
  const confirm: string[] = [];
  const cont: string[] = [];
  const invalidate: string[] = [];

  if (m.outperform90Pct != null && m.outperform90Pct < THRESHOLDS.outperformStrong) {
    confirm.push(
      `Que el porcentaje de altcoins que supera a BTC pase del ${m.outperform90Pct.toFixed(0)}% actual a más del ${THRESHOLDS.outperformStrong}%.`,
    );
  }
  if (m.dominanceChange30d != null && m.dominanceChange30d > -THRESHOLDS.dominanceTrend) {
    confirm.push('Que la dominancia de Bitcoin encadene una caída sostenida en 30 días.');
  }
  if (m.ethBtcChange30d != null && m.ethBtcChange30d < THRESHOLDS.ethBtcTrend) {
    confirm.push('Que ETH/BTC confirme una tendencia alcista clara.');
  }
  if (m.aboveSma50Pct != null && m.aboveSma50Pct < THRESHOLDS.breadthHealthy) {
    confirm.push(
      `Que más del ${THRESHOLDS.breadthHealthy}% de las altcoins recupere su media de 50 días.`,
    );
  }
  if (confirm.length === 0) {
    confirm.push('Las condiciones principales de una altseason ya se están cumpliendo.');
  }

  cont.push(`${PHASES[phase].label}: ${PHASES[phase].description}`);
  cont.push(`Para avanzar: ${PHASES[phase].next}`);

  invalidate.push('Que la dominancia de Bitcoin retome una subida sostenida.');
  invalidate.push('Que la amplitud caiga y la mayoría de altcoins pierda su media de 50 días.');
  if (m.ethBtcChange30d != null) {
    invalidate.push('Que ETH/BTC vuelva a marcar mínimos frente a Bitcoin.');
  }

  return { confirm, continue: cont, invalidate };
}

function computeConfidence(
  coverage: number,
  metrics: AltseasonMetrics,
  signalsFor: number,
  signalsAgainst: number,
): Confidence {
  const assets = metrics.analyzedCount;
  const stale =
    metrics.dataAgeHours != null && metrics.dataAgeHours > DATA_REQUIREMENTS.staleAfterHours;

  // Señales muy contradictorias rebajan la confianza aunque haya cobertura.
  const contradictory = signalsFor > 0 && signalsAgainst > 0 && Math.abs(signalsFor - signalsAgainst) <= 1;

  if (
    coverage >= CONFIDENCE_RULES.highWeight * 100 &&
    assets >= CONFIDENCE_RULES.highAssets &&
    !stale &&
    !metrics.fromCache &&
    !contradictory
  ) {
    return 'alta';
  }
  if (coverage >= CONFIDENCE_RULES.mediumWeight * 100 && assets >= CONFIDENCE_RULES.mediumAssets && !stale) {
    return 'media';
  }
  return 'baja';
}

/** Sanea entradas no finitas: un dato corrupto se trata como ausente. */
function sanitize(m: AltseasonMetrics): AltseasonMetrics {
  const clean = { ...m } as Record<string, unknown>;
  for (const [k, v] of Object.entries(clean)) {
    if (typeof v === 'number' && !Number.isFinite(v)) clean[k] = null;
  }
  return clean as unknown as AltseasonMetrics;
}

export function calculateAltseasonScore(rawMetrics: AltseasonMetrics): AltseasonResult {
  const m = sanitize(rawMetrics);

  const components: ScoreComponent[] = COMPONENTS.map((cfg) => {
    const raw = rawFor(cfg.id, m);
    const score = raw == null ? null : Math.round(normalize(raw, cfg.at0, cfg.at100));
    return {
      id: cfg.id,
      label: cfg.label,
      score,
      weight: Math.round(cfg.weight * 100),
      effectiveWeight: 0,
      rawValue: raw == null ? 'No disponible' : `${raw.toFixed(raw % 1 === 0 ? 0 : 2)}${cfg.unit}`,
      explanation: raw == null ? 'Sin datos de esta fuente.' : explain(cfg.id, raw, m),
    };
  });

  const available = components.filter((c) => c.score != null);
  const nominalAvailable = available.reduce(
    (acc, c) => acc + COMPONENTS.find((x) => x.id === c.id)!.weight,
    0,
  );
  const coverage = Math.round(nominalAvailable * 100);

  const { signalsFor, signalsAgainst } = buildSignals(m);

  // Sin datos suficientes NO se publica un 0: se declara no disponible.
  const notEnough =
    m.analyzedCount < DATA_REQUIREMENTS.minAssets ||
    nominalAvailable < DATA_REQUIREMENTS.minWeightAvailable;

  if (notEnough) {
    const reason =
      m.analyzedCount < DATA_REQUIREMENTS.minAssets
        ? `Solo se han podido analizar ${m.analyzedCount} altcoins (mínimo ${DATA_REQUIREMENTS.minAssets}).`
        : `Faltan demasiadas métricas: solo hay datos para el ${coverage}% del peso.`;
    return {
      score: null,
      unavailableReason: reason,
      classification: 'No disponible',
      summary: 'No hay datos suficientes para calcular el Altseason Score con fiabilidad.',
      phase: 'dominio-btc',
      phaseLabel: PHASES['dominio-btc'].label,
      confidence: 'baja',
      coverage,
      componentsAvailable: available.length,
      componentsTotal: COMPONENTS.length,
      missing: components.filter((c) => c.score == null).map((c) => c.label),
      components,
      signalsFor,
      signalsAgainst,
      penalties: [],
      scenarios: { confirm: [], continue: [], invalidate: [] },
    };
  }

  // Redistribución del peso de los componentes ausentes.
  const factor = 100 / nominalAvailable;
  for (const c of components) {
    if (c.score == null) continue;
    const cfg = COMPONENTS.find((x) => x.id === c.id)!;
    c.effectiveWeight = Number((cfg.weight * factor).toFixed(1));
  }

  const weighted = available.reduce((acc, c) => {
    const cfg = COMPONENTS.find((x) => x.id === c.id)!;
    return acc + c.score! * cfg.weight;
  }, 0);
  let score = clamp(Math.round(weighted / nominalAvailable));

  // Penalizaciones de riesgo: solo sobre scores ya altos.
  const penalties: { reason: string; points: number }[] = [];
  if (score > PENALTIES.applyAboveScore) {
    if (m.top5Concentration != null && m.top5Concentration > THRESHOLDS.concentrationHigh) {
      penalties.push({
        reason: `Rendimiento muy concentrado (las 5 mejores acaparan el ${(m.top5Concentration * 100).toFixed(0)}%)`,
        points: PENALTIES.concentration,
      });
    }
    if (m.avgAltVolatility != null && m.avgAltVolatility > THRESHOLDS.volatilityExtreme) {
      penalties.push({
        reason: `Volatilidad media extrema (${m.avgAltVolatility.toFixed(0)}% anualizada)`,
        points: PENALTIES.volatility,
      });
    }
  }
  score = clamp(score - penalties.reduce((a, p) => a + p.points, 0));

  const cls = classify(score);
  const phase = determinePhase(m, score);
  let confidence = computeConfidence(coverage, m, signalsFor.length, signalsAgainst.length);
  // Con penalizaciones de riesgo activas nunca se declara confianza alta.
  if (penalties.length > 0 && confidence === 'alta') confidence = 'media';

  return {
    score,
    unavailableReason: null,
    classification: cls.label,
    summary: cls.summary,
    phase,
    phaseLabel: PHASES[phase].label,
    confidence,
    coverage,
    componentsAvailable: available.length,
    componentsTotal: COMPONENTS.length,
    missing: components.filter((c) => c.score == null).map((c) => c.label),
    components,
    signalsFor,
    signalsAgainst,
    penalties,
    scenarios: buildScenarios(m, phase),
  };
}

/** Color por zona, reutilizable en el indicador visual. */
export function altseasonColor(score: number): string {
  if (score <= CLASSIFICATIONS[0]!.max) return '#f59e0b';
  if (score <= CLASSIFICATIONS[1]!.max) return '#eab308';
  if (score <= CLASSIFICATIONS[2]!.max) return '#94a3b8';
  if (score <= CLASSIFICATIONS[3]!.max) return '#22c55e';
  return '#8b5cf6';
}
