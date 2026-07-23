import { describe, it, expect } from 'vitest';
import {
  calculateAltseasonScore,
  determinePhase,
  normalize,
  type AltseasonMetrics,
} from './score';
import { COMPONENTS, DATA_REQUIREMENTS, classify, isExcludedSymbol } from './config';

/** Métricas vacías: nada disponible. */
const empty: AltseasonMetrics = {
  outperform90Pct: null,
  outperform60Pct: null,
  outperform30Pct: null,
  outperformCount: null,
  analyzedCount: 0,
  btcReturn90: null,
  btcDominance: null,
  dominanceChange24h: null,
  dominanceChange7d: null,
  dominanceChange30d: null,
  aboveSma20Pct: null,
  aboveSma50Pct: null,
  aboveSma200Pct: null,
  positive7dPct: null,
  positive30dPct: null,
  positive90dPct: null,
  near90dHighCount: null,
  drawdown20PlusCount: null,
  ethBtc: null,
  ethBtcChange24h: null,
  ethBtcChange7d: null,
  ethBtcChange30d: null,
  ethBtcChange90d: null,
  totalMarketCap: null,
  marketCapExBtc: null,
  marketCapExBtcEth: null,
  exBtcVsBtc30d: null,
  exBtcChange7d: null,
  exBtcChange30d: null,
  altVolumeSharePct: null,
  btcVolumeUsd: null,
  altVolumeUsd: null,
  avgAltVolatility: null,
  btcVolatility: null,
  top5Concentration: null,
  avgDrawdownFromHigh: null,
  stablecoinChange30d: null,
  stablecoinChange7d: null,
  dataAgeHours: 1,
  fromCache: false,
};

/** Métricas completas de un mercado claramente rotando a altcoins. */
const fullAltseason: AltseasonMetrics = {
  ...empty,
  analyzedCount: 48,
  outperformCount: 36,
  outperform90Pct: 75,
  outperform60Pct: 70,
  outperform30Pct: 65,
  btcReturn90: -5,
  btcDominance: 52,
  dominanceChange30d: -3.5,
  dominanceChange7d: -0.8,
  dominanceChange24h: -0.1,
  aboveSma50Pct: 78,
  aboveSma20Pct: 80,
  aboveSma200Pct: 60,
  ethBtcChange30d: 10,
  exBtcVsBtc30d: 12,
  altVolumeSharePct: 72,
  stablecoinChange30d: 6,
  avgAltVolatility: 70,
  top5Concentration: 0.3,
};

const con = (over: Partial<AltseasonMetrics>): AltseasonMetrics => ({ ...empty, ...over });

describe('Altseason · normalización y pesos', () => {
  it('normalize lleva a 0-100 y respeta escalas invertidas', () => {
    expect(normalize(20, 20, 75)).toBe(0);
    expect(normalize(75, 20, 75)).toBe(100);
    // Escala invertida (dominancia: menos es mejor)
    expect(normalize(-4, 4, -4)).toBe(100);
    expect(normalize(4, 4, -4)).toBe(0);
    // Fuera de rango se recorta
    expect(normalize(500, 20, 75)).toBe(100);
    expect(normalize(-500, 20, 75)).toBe(0);
  });

  it('los pesos configurados suman 100%', () => {
    const total = COMPONENTS.reduce((a, c) => a + c.weight, 0);
    expect(Number(total.toFixed(6))).toBe(1);
  });

  it('aplica los pesos: el componente dominante mueve más el score', () => {
    // Solo cambia el componente de 30% (outperformance)
    const bajo = calculateAltseasonScore({ ...fullAltseason, outperform90Pct: 20 });
    const alto = calculateAltseasonScore({ ...fullAltseason, outperform90Pct: 75 });
    expect(alto.score!).toBeGreaterThan(bajo.score!);
    // Con 30% de peso, mover ese componente de 0 a 100 mueve ~30 puntos
    expect(alto.score! - bajo.score!).toBeGreaterThan(20);
    expect(alto.score! - bajo.score!).toBeLessThan(40);
  });
});

describe('Altseason · rango y robustez', () => {
  it('nunca sale de 0-100 ni devuelve NaN', () => {
    const extremos = [
      con({ ...fullAltseason, outperform90Pct: 999, dominanceChange30d: -999, aboveSma50Pct: 999 }),
      con({ ...fullAltseason, outperform90Pct: -999, dominanceChange30d: 999, aboveSma50Pct: -999 }),
    ];
    for (const m of extremos) {
      const r = calculateAltseasonScore(m);
      expect(r.score).not.toBeNull();
      expect(Number.isNaN(r.score!)).toBe(false);
      expect(r.score!).toBeGreaterThanOrEqual(0);
      expect(r.score!).toBeLessThanOrEqual(100);
    }
  });

  it('trata valores no finitos como dato ausente', () => {
    const r = calculateAltseasonScore(
      con({ ...fullAltseason, outperform90Pct: Number.NaN, ethBtcChange30d: Number.POSITIVE_INFINITY }),
    );
    expect(Number.isNaN(r.score!)).toBe(false);
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it('un mercado alcista de alts puntúa más que uno dominado por BTC', () => {
    const alt = calculateAltseasonScore(fullAltseason);
    const btc = calculateAltseasonScore(
      con({
        analyzedCount: 48,
        outperformCount: 6,
        outperform90Pct: 12,
        dominanceChange30d: 3.5,
        aboveSma50Pct: 15,
        ethBtcChange30d: -9,
        exBtcVsBtc30d: -8,
        altVolumeSharePct: 38,
        stablecoinChange30d: -3,
      }),
    );
    expect(alt.score!).toBeGreaterThan(70);
    expect(btc.score!).toBeLessThan(25);
  });
});

describe('Altseason · datos ausentes', () => {
  it('NO devuelve 0 cuando faltan datos: devuelve score null y el motivo', () => {
    const r = calculateAltseasonScore(empty);
    expect(r.score).toBeNull();
    expect(r.unavailableReason).toBeTruthy();
    expect(r.classification).toBe('No disponible');
  });

  it('exige un mínimo de altcoins analizadas', () => {
    const r = calculateAltseasonScore(
      con({ ...fullAltseason, analyzedCount: DATA_REQUIREMENTS.minAssets - 1 }),
    );
    expect(r.score).toBeNull();
    expect(r.unavailableReason).toMatch(/altcoins/i);
  });

  it('redistribuye el peso de los componentes ausentes', () => {
    // Solo outperformance (30%) y dominancia (20%) = 50% de cobertura
    const r = calculateAltseasonScore(
      con({ analyzedCount: 40, outperformCount: 30, outperform90Pct: 75, dominanceChange30d: -3.5 }),
    );
    expect(r.score).not.toBeNull();
    expect(r.coverage).toBe(50);
    const suma = r.components.reduce((a, c) => a + c.effectiveWeight, 0);
    expect(Math.round(suma)).toBe(100);
    // Mantiene la proporción original 30:20
    const out = r.components.find((c) => c.id === 'outperformance')!;
    const dom = r.components.find((c) => c.id === 'dominance')!;
    expect(out.effectiveWeight / dom.effectiveWeight).toBeCloseTo(1.5, 1);
  });

  it('no declara confianza alta si faltan métricas importantes', () => {
    const r = calculateAltseasonScore(
      con({ analyzedCount: 40, outperformCount: 30, outperform90Pct: 75, dominanceChange30d: -3.5 }),
    );
    expect(r.confidence).not.toBe('alta');
  });

  it('baja la confianza con datos antiguos o de caché', () => {
    const viejo = calculateAltseasonScore({ ...fullAltseason, dataAgeHours: 72 });
    expect(viejo.confidence).toBe('baja');
    const cache = calculateAltseasonScore({ ...fullAltseason, fromCache: true });
    expect(cache.confidence).not.toBe('alta');
  });
});

describe('Altseason · clasificación y fases', () => {
  it('clasifica según los rangos configurados', () => {
    expect(classify(10).label).toBe('Dominio fuerte de Bitcoin');
    expect(classify(30).label).toBe('Rotación inicial');
    expect(classify(50).label).toBe('Mercado mixto');
    expect(classify(70).label).toBe('Altseason probable');
    expect(classify(95).label).toBe('Altseason fuerte');
    // Límites exactos
    expect(classify(20).label).toBe('Dominio fuerte de Bitcoin');
    expect(classify(21).label).toBe('Rotación inicial');
    expect(classify(0).label).toBe('Dominio fuerte de Bitcoin');
    expect(classify(100).label).toBe('Altseason fuerte');
  });

  it('detecta dominio de BTC y altseason amplia', () => {
    expect(
      determinePhase(con({ outperform90Pct: 10, dominanceChange30d: 2, ethBtcChange30d: -8 }), 15),
    ).toBe('dominio-btc');
    expect(
      determinePhase(
        con({ outperform90Pct: 70, dominanceChange30d: -2, aboveSma50Pct: 70 }),
        75,
      ),
    ).toBe('altseason-amplia');
  });

  it('detecta euforia solo si hay amplitud Y volatilidad extrema', () => {
    const base = { outperform90Pct: 70, aboveSma50Pct: 70, dominanceChange30d: -2 };
    expect(determinePhase(con({ ...base, avgAltVolatility: 60 }), 80)).toBe('altseason-amplia');
    expect(determinePhase(con({ ...base, avgAltVolatility: 150 }), 80)).toBe('euforia');
  });

  it('detecta enfriamiento cuando la amplitud cae y BTC recupera', () => {
    expect(
      determinePhase(
        con({ outperform90Pct: 30, dominanceChange30d: 2, aboveSma50Pct: 20 }),
        30,
      ),
    ).toBe('enfriamiento');
  });
});

describe('Altseason · señales, penalizaciones y escenarios', () => {
  it('genera señales a favor solo cuando el dato las respalda', () => {
    const r = calculateAltseasonScore(fullAltseason);
    expect(r.signalsFor.length).toBeGreaterThan(0);
    expect(r.signalsFor.every((s) => s.evidence.length > 0)).toBe(true);
    const texto = r.signalsFor.map((s) => s.text).join(' ');
    expect(texto).toMatch(/dominancia|supera|ETH\/BTC|amplitud|volumen/i);
  });

  it('penaliza concentración y volatilidad extremas, y rebaja la confianza', () => {
    const r = calculateAltseasonScore({
      ...fullAltseason,
      top5Concentration: 0.85,
      avgAltVolatility: 200,
    });
    expect(r.penalties.length).toBe(2);
    expect(r.confidence).not.toBe('alta');
    const sin = calculateAltseasonScore(fullAltseason);
    expect(r.score!).toBeLessThan(sin.score!);
  });

  it('no penaliza cuando el score es bajo', () => {
    const r = calculateAltseasonScore(
      con({
        analyzedCount: 40,
        outperformCount: 4,
        outperform90Pct: 10,
        dominanceChange30d: 3,
        aboveSma50Pct: 10,
        ethBtcChange30d: -10,
        exBtcVsBtc30d: -9,
        altVolumeSharePct: 35,
        stablecoinChange30d: -3,
        top5Concentration: 0.9,
        avgAltVolatility: 250,
      }),
    );
    expect(r.penalties).toHaveLength(0);
  });

  it('produce escenarios como condiciones, sin predecir precios', () => {
    const r = calculateAltseasonScore(fullAltseason);
    const todo = [...r.scenarios.confirm, ...r.scenarios.continue, ...r.scenarios.invalidate].join(' ');
    expect(todo.length).toBeGreaterThan(0);
    expect(todo).not.toMatch(/\$\s?\d|garantiz|asegurad|compra ahora/i);
  });
});

describe('Altseason · exclusión de activos', () => {
  it('excluye stablecoins', () => {
    expect(isExcludedSymbol('USDT', 'Tether')).toBe(true);
    expect(isExcludedSymbol('USDC', 'USDC')).toBe(true);
    expect(isExcludedSymbol('DAI', 'Dai')).toBe(true);
    expect(isExcludedSymbol('USDE', 'Ethena USDe')).toBe(true);
  });

  it('excluye envueltos, en staking y duplicados', () => {
    expect(isExcludedSymbol('WBTC', 'Wrapped Bitcoin')).toBe(true);
    expect(isExcludedSymbol('STETH', 'Lido Staked Ether')).toBe(true);
    expect(isExcludedSymbol('WEETH', 'Wrapped eETH')).toBe(true);
    expect(isExcludedSymbol('BTCB', 'Bitcoin BEP2')).toBe(true);
    expect(isExcludedSymbol('XYZ', 'Bridged USDC')).toBe(true);
  });

  it('NO excluye altcoins legítimas', () => {
    expect(isExcludedSymbol('ETH', 'Ethereum')).toBe(false);
    expect(isExcludedSymbol('SOL', 'Solana')).toBe(false);
    expect(isExcludedSymbol('LINK', 'Chainlink')).toBe(false);
    expect(isExcludedSymbol('ADA', 'Cardano')).toBe(false);
    expect(isExcludedSymbol('DOGE', 'Dogecoin')).toBe(false);
  });
});
