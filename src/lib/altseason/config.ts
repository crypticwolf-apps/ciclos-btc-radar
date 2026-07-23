// =============================================================================
// CONFIGURACIÓN CENTRAL DEL ALTSEASON SCORE
// -----------------------------------------------------------------------------
// TODO lo ajustable vive aquí: pesos, umbrales, periodos, clasificaciones,
// fases, penalizaciones, reglas de confianza y activos excluidos.
//
// La metodología que se muestra al usuario se genera A PARTIR de este fichero
// (ver `describeMethodology`), de modo que no puede quedar desactualizada
// respecto al cálculo real.
// =============================================================================

/** Identificador de cada componente del score. */
export type ComponentId =
  | 'outperformance'
  | 'dominance'
  | 'breadth'
  | 'ethbtc'
  | 'marketExBtc'
  | 'volume'
  | 'stablecoins';

export interface ComponentConfig {
  id: ComponentId;
  label: string;
  /** Peso en tanto por uno. La suma de todos debe dar 1. */
  weight: number;
  /** Qué mide y de dónde sale, en lenguaje llano. */
  description: string;
  /** Valor de la métrica que produce 0 puntos y el que produce 100. */
  at0: number;
  at100: number;
  /** Unidad para mostrar el valor crudo. */
  unit: string;
}

/**
 * Pesos del score. El rendimiento frente a BTC domina porque es la definición
 * literal de altseason; la dominancia va después; la liquidez pesa poco porque
 * es la señal más indirecta.
 */
export const COMPONENTS: readonly ComponentConfig[] = [
  {
    id: 'outperformance',
    label: 'Altcoins que superan a BTC (90 d)',
    weight: 0.3,
    description:
      'Porcentaje de las altcoins analizadas cuyo rendimiento a 90 días supera al de Bitcoin. Es la definición más directa de altseason.',
    at0: 20,
    at100: 75,
    unit: '%',
  },
  {
    id: 'dominance',
    label: 'Tendencia de la dominancia de BTC',
    weight: 0.2,
    description:
      'Variación de la dominancia de Bitcoin en 30 días. Si baja, el capital rota hacia altcoins; si sube, se concentra en BTC.',
    // -4 puntos de dominancia en 30 d = rotación fuerte (100); +4 = BTC absorbe (0).
    at0: 4,
    at100: -4,
    unit: 'pp 30 d',
  },
  {
    id: 'breadth',
    label: 'Amplitud del mercado',
    weight: 0.15,
    description:
      'Porcentaje de altcoins por encima de su media móvil de 50 días. Distingue una subida general de un rebote concentrado en pocas monedas.',
    at0: 20,
    at100: 80,
    unit: '%',
  },
  {
    id: 'ethbtc',
    label: 'Fortaleza de ETH/BTC',
    weight: 0.1,
    description:
      'Variación del par ETH/BTC en 30 días. Ethereum suele liderar la rotación hacia activos de mayor riesgo.',
    at0: -12,
    at100: 12,
    unit: '% 30 d',
  },
  {
    id: 'marketExBtc',
    label: 'Capitalización excluyendo BTC',
    weight: 0.1,
    description:
      'Crecimiento en 30 días de la capitalización del mercado sin contar Bitcoin, frente al crecimiento del propio Bitcoin.',
    at0: -10,
    at100: 15,
    unit: 'pp 30 d',
  },
  {
    id: 'volume',
    label: 'Volumen de altcoins frente a BTC',
    weight: 0.1,
    description:
      'Proporción del volumen negociado que va a altcoins en lugar de a Bitcoin. Solo puntúa alto si el rendimiento y la amplitud acompañan.',
    at0: 40,
    at100: 80,
    unit: '% del volumen',
  },
  {
    id: 'stablecoins',
    label: 'Liquidez en stablecoins',
    weight: 0.05,
    description:
      'Variación en 30 días del capital en stablecoins. Su expansión indica munición disponible para entrar al mercado.',
    at0: -4,
    at100: 8,
    unit: '% 30 d',
  },
] as const;

/** Clasificaciones del score. Rangos inclusivos por `max`. */
export interface Classification {
  max: number;
  label: string;
  summary: string;
}

export const CLASSIFICATIONS: readonly Classification[] = [
  {
    max: 20,
    label: 'Dominio fuerte de Bitcoin',
    summary: 'El capital se concentra en Bitcoin y muy pocas altcoins consiguen superarlo.',
  },
  {
    max: 40,
    label: 'Rotación inicial',
    summary: 'Empiezan a verse señales de rotación, pero Bitcoin sigue marcando el ritmo.',
  },
  {
    max: 60,
    label: 'Mercado mixto',
    summary: 'Ni Bitcoin ni las altcoins dominan con claridad: las señales están repartidas.',
  },
  {
    max: 80,
    label: 'Altseason probable',
    summary: 'Las altcoins ganan amplitud y rendimiento frente a Bitcoin en varios frentes a la vez.',
  },
  {
    max: 100,
    label: 'Altseason fuerte',
    summary: 'La mayoría del mercado supera a Bitcoin con amplitud y volumen acompañando.',
  },
] as const;

/** Fases del ciclo de altcoins, de menor a mayor rotación. */
export type PhaseId =
  | 'dominio-btc'
  | 'rotacion-eth'
  | 'expansion-grandes'
  | 'altseason-amplia'
  | 'euforia'
  | 'enfriamiento';

export interface PhaseConfig {
  id: PhaseId;
  label: string;
  description: string;
  /** Qué haría falta para avanzar a la siguiente fase. */
  next: string;
  /** Qué indicaría un retroceso. */
  back: string;
}

export const PHASES: Record<PhaseId, PhaseConfig> = {
  'dominio-btc': {
    id: 'dominio-btc',
    label: 'Dominio de Bitcoin',
    description:
      'El capital se concentra en Bitcoin: su dominancia sube y pocas altcoins consiguen superarlo.',
    next: 'Que ETH/BTC deje de caer y la dominancia de Bitcoin frene su subida.',
    back: 'Es ya la fase de menor rotación: un retroceso significaría más concentración aún en BTC.',
  },
  'rotacion-eth': {
    id: 'rotacion-eth',
    label: 'Rotación hacia Ethereum',
    description:
      'Ethereum empieza a fortalecerse frente a Bitcoin y la dominancia deja de subir, pero el movimiento aún no se extiende.',
    next: 'Que las grandes altcoins empiecen a superar a BTC y mejore la amplitud del mercado.',
    back: 'Que ETH/BTC vuelva a debilitarse y la dominancia de Bitcoin retome la subida.',
  },
  'expansion-grandes': {
    id: 'expansion-grandes',
    label: 'Expansión de grandes altcoins',
    description:
      'Las principales altcoins superan a Bitcoin y crece el volumen fuera de BTC, aunque el movimiento no llega todavía a todo el mercado.',
    next: 'Que una mayoría amplia de altcoins supere a BTC y la dominancia caiga con claridad.',
    back: 'Que las grandes altcoins pierdan fuerza frente a BTC y baje la amplitud.',
  },
  'altseason-amplia': {
    id: 'altseason-amplia',
    label: 'Altseason amplia',
    description:
      'Una mayoría relevante de altcoins supera a Bitcoin, la dominancia baja y el volumen y la amplitud confirman el movimiento.',
    next: 'Que la subida se acelere con fuerte participación de activos pequeños y volatilidad alta.',
    back: 'Que la amplitud se estanque y las altcoins empiecen a perder contra BTC.',
  },
  euforia: {
    id: 'euforia',
    label: 'Euforia',
    description:
      'Subidas muy rápidas, alta participación de activos pequeños y volatilidad elevada. Históricamente es la fase de mayor riesgo.',
    next: 'No hay fase superior: desde aquí el ciclo suele enfriarse.',
    back: 'Que caiga la amplitud y aumenten las caídas desde máximos.',
  },
  enfriamiento: {
    id: 'enfriamiento',
    label: 'Distribución o enfriamiento',
    description:
      'La amplitud pierde fuerza, baja el volumen y las altcoins empiezan a perder contra Bitcoin, que recupera dominancia.',
    next: 'Que vuelva a mejorar la amplitud y ETH/BTC recupere tendencia.',
    back: 'Que la dominancia de Bitcoin siga recuperando y el mercado vuelva a concentrarse en BTC.',
  },
};

/** Umbrales que deciden fases, señales y penalizaciones. */
export const THRESHOLDS = {
  /** % de altcoins superando a BTC que marca cada nivel de rotación. */
  outperformStrong: 60,
  outperformModerate: 45,
  outperformWeak: 30,
  /** Variación de dominancia (pp, 30 d) que se considera tendencia real. */
  dominanceTrend: 0.6,
  /** Variación de ETH/BTC (%, 30 d) que se considera tendencia real. */
  ethBtcTrend: 3,
  /** % de altcoins sobre su media de 50 d que indica amplitud sana. */
  breadthHealthy: 55,
  breadthWeak: 30,
  /** Volatilidad anualizada media (%) a partir de la cual hay riesgo extremo. */
  volatilityExtreme: 120,
  /** Cuota del rendimiento total que acaparan las 5 mejores para hablar de concentración. */
  concentrationHigh: 0.6,
} as const;

/** Penalizaciones al score por riesgo, en puntos. */
export const PENALTIES = {
  /** Se aplica si el score es alto pero la subida está muy concentrada. */
  concentration: 6,
  /** Se aplica si la volatilidad media es extrema. */
  volatility: 5,
  /** Score por encima del cual tiene sentido penalizar el riesgo. */
  applyAboveScore: 55,
} as const;

/** Requisitos mínimos para que el score sea calculable y fiable. */
export const DATA_REQUIREMENTS = {
  /** Sin este nº de altcoins válidas no se publica score. */
  minAssets: 15,
  /** Nº de altcoins objetivo del análisis. */
  targetAssets: 50,
  /** Peso mínimo disponible (0-1) para publicar score. */
  minWeightAvailable: 0.45,
  /** Horas tras las que un dato se considera antiguo. */
  staleAfterHours: 24,
} as const;

/** Reglas de confianza. */
export const CONFIDENCE_RULES = {
  /** Peso disponible mínimo para confianza alta / media. */
  highWeight: 0.85,
  mediumWeight: 0.6,
  /** Nº de altcoins mínimo para confianza alta / media. */
  highAssets: 40,
  mediumAssets: 25,
} as const;

/**
 * Exclusiones del universo de altcoins.
 *
 * Se excluyen porque su precio no refleja rotación de capital hacia altcoins:
 * las stablecoins están ancladas al dólar y los derivados envueltos o en
 * staking replican el precio de otro activo que ya está en la lista.
 */
export const EXCLUSIONS = {
  /** Símbolos de stablecoins y activos anclados (oro incluido). */
  stableSymbols: [
    'USDT', 'USDC', 'USDS', 'DAI', 'FDUSD', 'TUSD', 'USDE', 'PYUSD', 'USDD',
    'BUSD', 'EURC', 'USD1', 'RLUSD', 'USDP', 'GUSD', 'LUSD', 'FRAX', 'SUSD',
    'USDF', 'USDX', 'BUIDL', 'USTC', 'EURS', 'XAUT', 'PAXG', 'USDG', 'USDY',
  ],
  /** Prefijos de símbolo que indican activo anclado a una divisa. */
  peggedPrefixes: ['USD', 'EUR', 'GBP'],
  /** Patrones de NOMBRE que indican derivado/duplicado de otro activo. */
  derivativeNamePattern:
    /wrapped|staked|bridged|restaked|liquid staking|liquid restak|tokenized|synthetic/i,
  /** Símbolos concretos que duplican un activo ya presente. */
  duplicateSymbols: ['WBTC', 'WETH', 'WBETH', 'STETH', 'WSTETH', 'WEETH', 'RETH', 'CBBTC', 'LBTC', 'SOLVBTC', 'WBNB', 'BSC-USD', 'BTCB'],
} as const;

/** Periodos analizados, en días. */
export const PERIODS = { short: 30, mid: 60, main: 90 } as const;

/** Medias móviles usadas para la amplitud, en días. */
export const MOVING_AVERAGES = [20, 50, 200] as const;

// --- Utilidades derivadas de la configuración -------------------------------

export function componentById(id: ComponentId): ComponentConfig {
  const found = COMPONENTS.find((c) => c.id === id);
  if (!found) throw new Error(`Componente de altseason desconocido: ${id}`);
  return found;
}

export function classify(score: number): Classification {
  return CLASSIFICATIONS.find((c) => score <= c.max) ?? CLASSIFICATIONS[CLASSIFICATIONS.length - 1]!;
}

/** ¿Un símbolo queda fuera del universo de altcoins? */
export function isExcludedSymbol(symbol: string, name: string): boolean {
  const sym = symbol.toUpperCase();
  if (EXCLUSIONS.stableSymbols.includes(sym as (typeof EXCLUSIONS.stableSymbols)[number])) return true;
  if (EXCLUSIONS.duplicateSymbols.includes(sym as (typeof EXCLUSIONS.duplicateSymbols)[number])) return true;
  if (EXCLUSIONS.peggedPrefixes.some((p) => sym.startsWith(p))) return true;
  if (EXCLUSIONS.derivativeNamePattern.test(name)) return true;
  return false;
}

/**
 * Texto de metodología generado desde esta misma configuración, para que lo que
 * se muestra al usuario no pueda divergir de lo que se calcula.
 */
export function describeMethodology(): {
  components: { label: string; weightPct: number; description: string; range: string }[];
  periods: string;
  exclusions: string[];
  penalties: string[];
} {
  return {
    components: COMPONENTS.map((c) => ({
      label: c.label,
      weightPct: Math.round(c.weight * 100),
      description: c.description,
      range: `${c.at0}${c.unit} → 0 puntos · ${c.at100}${c.unit} → 100 puntos`,
    })),
    periods: `Periodos analizados: ${PERIODS.short}, ${PERIODS.mid} y ${PERIODS.main} días (la señal principal usa ${PERIODS.main} días). Medias móviles de ${MOVING_AVERAGES.join(', ')} días.`,
    exclusions: [
      'Stablecoins y activos anclados a una divisa o al oro.',
      'Versiones envueltas, en staking o puenteadas de un activo ya presente.',
      'Activos sin par al contado en el proveedor de velas o sin histórico suficiente.',
      `Se analizan las ${DATA_REQUIREMENTS.targetAssets} mayores altcoins elegibles por capitalización.`,
    ],
    penalties: [
      `Concentración: −${PENALTIES.concentration} puntos si las 5 mejores acaparan más del ${Math.round(THRESHOLDS.concentrationHigh * 100)}% del rendimiento y el score supera ${PENALTIES.applyAboveScore}.`,
      `Volatilidad: −${PENALTIES.volatility} puntos si la volatilidad media anualizada supera el ${THRESHOLDS.volatilityExtreme}%.`,
    ],
  };
}
