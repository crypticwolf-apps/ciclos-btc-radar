// =============================================================================
// SCORE DE OPORTUNIDAD (0-100)
// -----------------------------------------------------------------------------
// Cómo está construido y por qué:
//
//   · Siete BLOQUES temáticos independientes. Cada uno produce su propia nota
//     de 0 a 100 (0 = riesgo máximo, 100 = oportunidad máxima) y tiene un peso.
//     El resultado es la media ponderada. Así ningún dato suelto puede mover el
//     score entero: como mucho mueve su bloque, y el bloque pesa lo que pesa.
//
//   · Un bloque SIN datos vale `null`, no cero. Tratar «no lo sé» como «cero»
//     hundiría el score cada vez que cayera una API. En su lugar su peso se
//     REDISTRIBUYE proporcionalmente entre los bloques que sí tienen datos, y
//     se rebaja la CONFIANZA declarada.
//
//   · Todo el cálculo es determinista y explicable: cada bloque publica los
//     datos que ha usado, su nota, su peso efectivo y una explicación en una
//     frase. La interfaz puede mostrar exactamente de dónde sale el número.
//
// El score describe el CONTEXTO, no predice el precio ni es una recomendación.
// =============================================================================

export type BlockId =
  | 'ciclo'
  | 'tecnico'
  | 'sentimiento'
  | 'derivados'
  | 'liquidez'
  | 'red'
  | 'riesgo';

export interface ScoreInput {
  label: string;
  value: string;
}

export interface ScoreBlock {
  id: BlockId;
  label: string;
  /** Nota 0-100 del bloque, o `null` si no hay datos suficientes. */
  score: number | null;
  /** Peso nominal (suman 100 entre los siete). */
  weight: number;
  /** Peso real aplicado tras redistribuir el de los bloques sin datos. */
  effectiveWeight: number;
  /** Datos concretos usados, para que el usuario pueda auditarlo. */
  inputs: ScoreInput[];
  explanation: string;
  /** Fecha del dato más relevante del bloque (ISO), si se conoce. */
  updatedAt: string | null;
}

export type Confidence = 'alta' | 'media' | 'baja';

export interface OpportunityScore {
  score: number;
  etiqueta: string;
  resumen: string;
  confianza: Confidence;
  /** Porcentaje del peso nominal que sí tiene datos (0-100). */
  cobertura: number;
  bloquesDisponibles: number;
  bloquesTotales: number;
  /** Nombres de los bloques sin datos. */
  faltantes: string[];
  bloques: ScoreBlock[];
  /** Motivos que más elevan y más reducen el score. */
  suben: string[];
  bajan: string[];
}

// --- Utilidades --------------------------------------------------------------

const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));

/**
 * Interpola linealmente un valor entre dos extremos y lo lleva a 0-100.
 * `at0` produce 0 y `at100` produce 100 (pueden ir en orden inverso).
 */
function scale(value: number, at0: number, at100: number): number {
  if (at0 === at100) return 50;
  return clamp(((value - at0) / (at100 - at0)) * 100);
}

// --- Entradas ----------------------------------------------------------------

export interface ScoreSources {
  drawdownFromAthPct: number | null; // negativo
  price: number | null;
  mvrv: number | null;
  nupl: number | null;
  puell: number | null;
  cycleLow: number | null;
  cycleHigh: number | null;
  daysSinceHalving: number | null;

  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  sma200w: number | null;
  cross: 'golden' | 'death' | 'ninguno';
  return30d: number | null;
  return90d: number | null;

  fearGreed: number | null;
  fearGreedLabel: string | null;

  fundingRate: number | null; // tanto por uno, 8 h
  openInterestChange24hPct: number | null;
  longShortRatio: number | null;

  stablecoinChange30dPct: number | null;
  stablecoinTrend: 'expansion' | 'contraccion' | 'estable' | null;

  hashrateEhs: number | null;
  nextDifficultyAdjustmentPct: number | null;
  mempoolBlocksToClear: number | null;

  volatility30d: number | null;

  /** Fechas de observación conocidas, por bloque. */
  observedAt?: Partial<Record<BlockId, string | null>>;
}

// --- Bloques -----------------------------------------------------------------

interface Draft {
  id: BlockId;
  label: string;
  weight: number;
  parts: { value: number; label: string; detail: string }[];
  inputs: ScoreInput[];
  explain: (score: number) => string;
}

/** 1) Ciclo: dónde estamos respecto a máximos y a la valoración on-chain. */
function blockCiclo(s: ScoreSources): Draft {
  const parts: Draft['parts'] = [];
  const inputs: ScoreInput[] = [];

  if (s.drawdownFromAthPct != null) {
    // -70% desde máximos = 100 (oportunidad), 0% = 0 (riesgo).
    parts.push({
      value: scale(s.drawdownFromAthPct, 0, -70),
      label: 'Caída desde el máximo',
      detail: `${s.drawdownFromAthPct.toFixed(1)}%`,
    });
    inputs.push({ label: 'Desde el ATH', value: `${s.drawdownFromAthPct.toFixed(1)}%` });
  }

  if (s.mvrv != null) {
    // MVRV 0,8 = suelo histórico (100); 3,5 = sobrecalentado (0).
    parts.push({
      value: scale(s.mvrv, 3.5, 0.8),
      label: 'MVRV',
      detail: s.mvrv.toFixed(2),
    });
    inputs.push({ label: 'MVRV', value: s.mvrv.toFixed(2) });
  }

  if (s.nupl != null) {
    // NUPL 0,6 = euforia (0); -0,2 = capitulación (100).
    parts.push({ value: scale(s.nupl, 0.6, -0.2), label: 'NUPL', detail: `${(s.nupl * 100).toFixed(0)}%` });
    inputs.push({ label: 'NUPL', value: `${(s.nupl * 100).toFixed(0)}%` });
  }

  if (s.puell != null) {
    // Puell 0,4 = mineros exprimidos, suele coincidir con suelos (100); 4 = techo (0).
    parts.push({ value: scale(s.puell, 4, 0.4), label: 'Puell Multiple', detail: s.puell.toFixed(2) });
    inputs.push({ label: 'Puell Multiple', value: s.puell.toFixed(2) });
  }

  if (s.price != null && s.cycleLow != null && s.cycleHigh != null && s.cycleHigh > s.cycleLow) {
    const pos = ((s.price - s.cycleLow) / (s.cycleHigh - s.cycleLow)) * 100;
    parts.push({ value: clamp(100 - pos), label: 'Posición en el ciclo', detail: `${pos.toFixed(0)}%` });
    inputs.push({ label: 'Posición en el rango del ciclo', value: `${pos.toFixed(0)}%` });
  }

  if (s.daysSinceHalving != null) {
    inputs.push({ label: 'Días desde el halving', value: String(s.daysSinceHalving) });
  }

  return {
    id: 'ciclo',
    label: 'Ciclo y distancia a máximos',
    weight: 22,
    parts,
    inputs,
    explain: (score) =>
      score >= 65
        ? 'El precio está lejos de máximos y la valoración on-chain se sitúa en la parte baja de su rango histórico.'
        : score >= 40
          ? 'El ciclo está en una zona intermedia: ni cerca de máximos ni en valoraciones de suelo.'
          : 'El precio se acerca a máximos y la valoración on-chain está en la parte alta de su rango.',
  };
}

/** 2) Técnico: estructura de medias y momentum. */
function blockTecnico(s: ScoreSources): Draft {
  const parts: Draft['parts'] = [];
  const inputs: ScoreInput[] = [];

  if (s.rsi14 != null) {
    // RSI 25 = sobreventa (100); 75 = sobrecompra (0).
    parts.push({ value: scale(s.rsi14, 75, 25), label: 'RSI', detail: s.rsi14.toFixed(0) });
    inputs.push({ label: 'RSI (14 d)', value: s.rsi14.toFixed(1) });
  }

  if (s.price != null && s.sma200 != null) {
    const dist = ((s.price - s.sma200) / s.sma200) * 100;
    // Comprar un 30% por debajo de la media de 200 d ha sido históricamente
    // mejor punto de entrada que un 50% por encima.
    parts.push({ value: scale(dist, 50, -30), label: 'Distancia a la media de 200 d', detail: `${dist.toFixed(1)}%` });
    inputs.push({ label: 'vs. media 200 d', value: `${dist >= 0 ? '+' : ''}${dist.toFixed(1)}%` });
  }

  if (s.price != null && s.sma200w != null) {
    const dist = ((s.price - s.sma200w) / s.sma200w) * 100;
    parts.push({ value: scale(dist, 300, 0), label: 'Distancia a la media de 200 semanas', detail: `${dist.toFixed(0)}%` });
    inputs.push({ label: 'vs. media 200 sem.', value: `${dist >= 0 ? '+' : ''}${dist.toFixed(0)}%` });
  }

  if (s.cross !== 'ninguno') {
    // Un cruce alcista es señal de tendencia, no de oportunidad barata: pesa poco.
    parts.push({
      value: s.cross === 'golden' ? 58 : 42,
      label: 'Cruce de medias',
      detail: s.cross === 'golden' ? 'media de 50 d por encima' : 'media de 50 d por debajo',
    });
    inputs.push({
      label: 'Cruce 50/200',
      value: s.cross === 'golden' ? 'alcista' : 'bajista',
    });
  }

  if (s.return90d != null) {
    parts.push({ value: scale(s.return90d, 80, -50), label: 'Rendimiento 90 d', detail: `${s.return90d.toFixed(1)}%` });
    inputs.push({ label: 'Rendimiento 90 d', value: `${s.return90d >= 0 ? '+' : ''}${s.return90d.toFixed(1)}%` });
  }

  return {
    id: 'tecnico',
    label: 'Tendencia técnica',
    weight: 18,
    parts,
    inputs,
    explain: (score) =>
      score >= 65
        ? 'El precio cotiza por debajo de sus medias de referencia y el momentum está en la zona baja.'
        : score >= 40
          ? 'La estructura técnica está equilibrada respecto a sus medias de largo plazo.'
          : 'El precio cotiza muy por encima de sus medias y el momentum está en la zona alta.',
  };
}

/** 3) Sentimiento: el miedo ajeno como medida de contexto. */
function blockSentimiento(s: ScoreSources): Draft {
  const parts: Draft['parts'] = [];
  const inputs: ScoreInput[] = [];

  if (s.fearGreed != null) {
    // Índice invertido: 0 (miedo extremo) = 100 de oportunidad.
    parts.push({ value: 100 - clamp(s.fearGreed), label: 'Miedo y codicia', detail: String(s.fearGreed) });
    inputs.push({
      label: 'Fear & Greed',
      value: `${s.fearGreed}${s.fearGreedLabel ? ` · ${s.fearGreedLabel}` : ''}`,
    });
  }

  return {
    id: 'sentimiento',
    label: 'Sentimiento',
    weight: 15,
    parts,
    inputs,
    explain: (score) =>
      score >= 65
        ? 'Predomina el miedo. Históricamente el pesimismo extremo ha coincidido con mejores puntos de entrada que la euforia.'
        : score >= 40
          ? 'El sentimiento del mercado es neutral.'
          : 'Predomina la codicia, que suele acompañar a fases más avanzadas del ciclo.',
  };
}

/** 4) Derivados: cuánto apalancamiento hay y hacia qué lado. */
function blockDerivados(s: ScoreSources): Draft {
  const parts: Draft['parts'] = [];
  const inputs: ScoreInput[] = [];

  if (s.fundingRate != null) {
    const pct8h = s.fundingRate * 100;
    // Funding muy positivo = largos apalancados pagando: mercado recalentado.
    parts.push({ value: scale(pct8h, 0.08, -0.02), label: 'Funding', detail: `${pct8h.toFixed(4)}%` });
    inputs.push({ label: 'Funding (8 h)', value: `${pct8h >= 0 ? '+' : ''}${pct8h.toFixed(4)}%` });
  }

  if (s.openInterestChange24hPct != null) {
    // Interés abierto disparándose = más riesgo de liquidaciones en cadena.
    parts.push({
      value: scale(s.openInterestChange24hPct, 15, -10),
      label: 'Interés abierto 24 h',
      detail: `${s.openInterestChange24hPct.toFixed(1)}%`,
    });
    inputs.push({
      label: 'Interés abierto 24 h',
      value: `${s.openInterestChange24hPct >= 0 ? '+' : ''}${s.openInterestChange24hPct.toFixed(1)}%`,
    });
  }

  if (s.longShortRatio != null) {
    parts.push({ value: scale(s.longShortRatio, 3, 0.8), label: 'Ratio long/short', detail: s.longShortRatio.toFixed(2) });
    inputs.push({ label: 'Cuentas largas / cortas', value: s.longShortRatio.toFixed(2) });
  }

  return {
    id: 'derivados',
    label: 'Derivados y apalancamiento',
    weight: 12,
    parts,
    inputs,
    explain: (score) =>
      score >= 65
        ? 'Hay poco apalancamiento alcista acumulado: menos riesgo de liquidaciones en cadena.'
        : score >= 40
          ? 'El apalancamiento está en niveles normales.'
          : 'Hay apalancamiento alcista acumulado y coste de financiación elevado: sube el riesgo de correcciones bruscas.',
  };
}

/** 5) Liquidez: cuánto capital en stablecoins hay listo para entrar. */
function blockLiquidez(s: ScoreSources): Draft {
  const parts: Draft['parts'] = [];
  const inputs: ScoreInput[] = [];

  if (s.stablecoinChange30dPct != null) {
    // +8% en 30 días es una expansión fuerte; -5%, una contracción marcada.
    parts.push({
      value: scale(s.stablecoinChange30dPct, -5, 8),
      label: 'Stablecoins 30 d',
      detail: `${s.stablecoinChange30dPct.toFixed(2)}%`,
    });
    inputs.push({
      label: 'Stablecoins 30 d',
      value: `${s.stablecoinChange30dPct >= 0 ? '+' : ''}${s.stablecoinChange30dPct.toFixed(2)}%`,
    });
  }
  if (s.stablecoinTrend) {
    inputs.push({
      label: 'Tendencia de liquidez',
      value:
        s.stablecoinTrend === 'expansion'
          ? 'expansión'
          : s.stablecoinTrend === 'contraccion'
            ? 'contracción'
            : 'estable',
    });
  }

  return {
    id: 'liquidez',
    label: 'Liquidez',
    weight: 12,
    parts,
    inputs,
    explain: (score) =>
      score >= 65
        ? 'El capital en stablecoins crece: hay más munición disponible para entrar al mercado.'
        : score >= 40
          ? 'La liquidez en stablecoins se mantiene estable.'
          : 'El capital en stablecoins se contrae, señal de salida de dinero del ecosistema.',
  };
}

/** 6) Red: salud y seguridad de la cadena. */
function blockRed(s: ScoreSources): Draft {
  const parts: Draft['parts'] = [];
  const inputs: ScoreInput[] = [];

  if (s.nextDifficultyAdjustmentPct != null) {
    // Una dificultad al alza indica mineros entrando: convicción en la red.
    parts.push({
      value: scale(s.nextDifficultyAdjustmentPct, -8, 8),
      label: 'Próximo ajuste de dificultad',
      detail: `${s.nextDifficultyAdjustmentPct.toFixed(2)}%`,
    });
    inputs.push({
      label: 'Próximo ajuste de dificultad',
      value: `${s.nextDifficultyAdjustmentPct >= 0 ? '+' : ''}${s.nextDifficultyAdjustmentPct.toFixed(2)}%`,
    });
  }

  if (s.mempoolBlocksToClear != null) {
    // Congestión alta encarece usar la red; no es bueno ni malo para el precio,
    // pero sí un indicador de fricción, así que pesa poco y en rango estrecho.
    parts.push({
      value: scale(s.mempoolBlocksToClear, 150, 2),
      label: 'Congestión',
      detail: `${s.mempoolBlocksToClear} bloques`,
    });
    inputs.push({ label: 'Cola de la mempool', value: `${s.mempoolBlocksToClear} bloques` });
  }

  if (s.hashrateEhs != null) {
    inputs.push({ label: 'Hashrate', value: `${s.hashrateEhs.toFixed(0)} EH/s` });
  }

  return {
    id: 'red',
    label: 'Red Bitcoin',
    weight: 8,
    parts,
    inputs,
    explain: (score) =>
      score >= 65
        ? 'La red gana potencia de minado y opera sin congestión.'
        : score >= 40
          ? 'La red funciona con normalidad.'
          : 'La red pierde potencia de minado o está congestionada.',
  };
}

/** 7) Riesgo: volatilidad realizada. */
function blockRiesgo(s: ScoreSources): Draft {
  const parts: Draft['parts'] = [];
  const inputs: ScoreInput[] = [];

  if (s.volatility30d != null) {
    // Volatilidad baja = entorno más manejable para construir posición.
    parts.push({
      value: scale(s.volatility30d, 90, 25),
      label: 'Volatilidad 30 d',
      detail: `${s.volatility30d.toFixed(0)}%`,
    });
    inputs.push({ label: 'Volatilidad anualizada (30 d)', value: `${s.volatility30d.toFixed(1)}%` });
  }

  if (s.return30d != null) {
    // Subidas verticales recientes elevan el riesgo de retroceso.
    parts.push({ value: scale(s.return30d, 45, -25), label: 'Rendimiento 30 d', detail: `${s.return30d.toFixed(1)}%` });
    inputs.push({ label: 'Rendimiento 30 d', value: `${s.return30d >= 0 ? '+' : ''}${s.return30d.toFixed(1)}%` });
  }

  return {
    id: 'riesgo',
    label: 'Riesgo y volatilidad',
    weight: 13,
    parts,
    inputs,
    explain: (score) =>
      score >= 65
        ? 'La volatilidad reciente es contenida y el precio no viene de un tramo vertical.'
        : score >= 40
          ? 'La volatilidad está en niveles habituales para Bitcoin.'
          : 'La volatilidad es alta o el precio viene de un movimiento muy rápido: mayor riesgo de vaivenes.',
  };
}

// --- Cálculo -----------------------------------------------------------------

/**
 * Sustituye por `null` cualquier número no finito (NaN, ±Infinity) que llegue
 * de una API. Un dato corrupto debe comportarse como un dato AUSENTE —y activar
 * la redistribución de pesos— en lugar de envenenar el resultado.
 */
function sanitize(sources: ScoreSources): ScoreSources {
  const clean = { ...sources } as Record<string, unknown>;
  for (const [key, value] of Object.entries(clean)) {
    if (typeof value === 'number' && !Number.isFinite(value)) clean[key] = null;
  }
  return clean as unknown as ScoreSources;
}

export function computeOpportunityScore(rawSources: ScoreSources): OpportunityScore {
  const sources = sanitize(rawSources);

  const drafts = [
    blockCiclo(sources),
    blockTecnico(sources),
    blockSentimiento(sources),
    blockDerivados(sources),
    blockLiquidez(sources),
    blockRed(sources),
    blockRiesgo(sources),
  ];

  // Nota de cada bloque = media simple de sus componentes válidos.
  const scored = drafts.map((d) => {
    const parts = d.parts.filter((p) => Number.isFinite(p.value));
    const score =
      parts.length === 0
        ? null
        : Math.round(parts.reduce((acc, p) => acc + p.value, 0) / parts.length);
    return { draft: d, score };
  });

  const withData = scored.filter((b) => b.score != null);
  const nominalAvailable = withData.reduce((acc, b) => acc + b.draft.weight, 0);

  // Redistribución: el peso de los bloques sin datos se reparte entre los que
  // sí lo tienen, en proporción a su peso nominal.
  const factor = nominalAvailable > 0 ? 100 / nominalAvailable : 0;

  const bloques: ScoreBlock[] = scored.map(({ draft, score }) => ({
    id: draft.id,
    label: draft.label,
    score,
    weight: draft.weight,
    effectiveWeight: score == null ? 0 : Number((draft.weight * factor).toFixed(1)),
    inputs: draft.inputs,
    explanation: score == null ? 'Sin datos suficientes de esta fuente.' : draft.explain(score),
    updatedAt: sources.observedAt?.[draft.id] ?? null,
  }));

  const total =
    nominalAvailable > 0
      ? Math.round(
          withData.reduce((acc, b) => acc + b.score! * b.draft.weight, 0) / nominalAvailable,
        )
      : 50;

  const score = clamp(total);
  const cobertura = Math.round(nominalAvailable);
  const confianza: Confidence = cobertura >= 85 ? 'alta' : cobertura >= 60 ? 'media' : 'baja';

  // Motivos: los bloques que más se desvían de la neutralidad, ponderados.
  const desviaciones = bloques
    .filter((b) => b.score != null)
    .map((b) => ({ b, impacto: (b.score! - 50) * (b.effectiveWeight / 100) }))
    .sort((x, y) => Math.abs(y.impacto) - Math.abs(x.impacto));

  const suben = desviaciones
    .filter((d) => d.impacto > 1)
    .slice(0, 3)
    .map((d) => `${d.b.label}: ${d.b.explanation}`);
  const bajan = desviaciones
    .filter((d) => d.impacto < -1)
    .slice(0, 3)
    .map((d) => `${d.b.label}: ${d.b.explanation}`);

  return {
    score,
    etiqueta: scoreLabel(score),
    resumen: scoreSummary(score, confianza),
    confianza,
    cobertura,
    bloquesDisponibles: withData.length,
    bloquesTotales: drafts.length,
    faltantes: bloques.filter((b) => b.score == null).map((b) => b.label),
    bloques,
    suben,
    bajan,
  };
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Contexto muy favorable';
  if (score >= 65) return 'Contexto favorable';
  if (score >= 50) return 'Contexto equilibrado';
  if (score >= 35) return 'Contexto exigente';
  return 'Contexto de riesgo elevado';
}

function scoreSummary(score: number, confianza: Confidence): string {
  const base =
    score >= 80
      ? 'La mayoría de los bloques apuntan a una zona históricamente favorable: precio lejos de máximos, sentimiento deprimido y poco apalancamiento acumulado.'
      : score >= 65
        ? 'Varios bloques apuntan a una zona de valor, aunque no todos acompañan.'
        : score >= 50
          ? 'El balance entre bloques está equilibrado, sin extremos claros en ninguna dirección.'
          : score >= 35
            ? 'Varios bloques muestran tensión: conviene prudencia con el riesgo asumido.'
            : 'Predominan las señales de riesgo: precio cerca de máximos, sentimiento eufórico o apalancamiento elevado.';

  if (confianza === 'baja') {
    return `${base} Atención: faltan fuentes y la confianza del cálculo es baja.`;
  }
  if (confianza === 'media') {
    return `${base} Alguna fuente no está disponible, así que la confianza es media.`;
  }
  return base;
}

export function scoreColor(score: number): string {
  if (score >= 65) return '#22c55e';
  if (score >= 50) return '#84cc16';
  if (score >= 35) return '#f59e0b';
  return '#ef4444';
}
