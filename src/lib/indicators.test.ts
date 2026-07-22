import { describe, it, expect } from 'vitest';
import {
  HALVING_FACTS,
  HALVING_PEAK_WINDOW_MONTHS,
  halvingTiming,
  rsi,
  sma,
  realizedVolatility,
  returnOver,
  positionInRange,
  maCross,
  computeTechnicals,
} from './indicators';

describe('Hechos de los halvings', () => {
  it('son cuatro, con altura de bloque y recompensa coherentes', () => {
    expect(HALVING_FACTS).toHaveLength(4);
    HALVING_FACTS.forEach((h, i) => {
      // Cada halving ocurre 210.000 bloques después del anterior.
      expect(h.block).toBe(210_000 * (i + 1));
      expect(h.reward).toMatch(/BTC$/);
      expect(Number.isNaN(Date.parse(h.at))).toBe(false);
    });
  });

  it('están ordenados y separados por unos cuatro años', () => {
    for (let i = 1; i < HALVING_FACTS.length; i++) {
      const anterior = Date.parse(HALVING_FACTS[i - 1]!.at);
      const actual = Date.parse(HALVING_FACTS[i]!.at);
      expect(actual).toBeGreaterThan(anterior);
      const años = (actual - anterior) / (365.25 * 86_400_000);
      expect(años).toBeGreaterThan(3.5);
      expect(años).toBeLessThan(4.5);
    }
  });

  it('la ventana de búsqueda del pico es de 18 meses', () => {
    expect(HALVING_PEAK_WINDOW_MONTHS).toBe(18);
  });

  it('la fecha del bloque 840.000 es posterior a medianoche UTC del 20 de abril de 2024', () => {
    // Detalle que importa: el bloque se minó a las 00:09 UTC del día 20, no el 19.
    // Buscar el precio comparando contra esa HORA exacta descartaría el cierre
    // diario de ese mismo día (marcado a las 00:00) y devolvería el del día
    // siguiente, desviando el precio del halving casi un 1 %.
    const cuarto = HALVING_FACTS[3]!;
    expect(cuarto.at.slice(0, 10)).toBe('2024-04-20');
    expect(new Date(cuarto.at).getUTCHours()).toBe(0);
    expect(new Date(cuarto.at).getUTCMinutes()).toBeGreaterThan(0);
  });

  it('halvingTiming sitúa el ciclo actual tras el último halving ocurrido', () => {
    const enJulio2026 = Date.parse('2026-07-22T00:00:00Z');
    const t = halvingTiming(enJulio2026);
    expect(t.lastHalvingDate).toBe(HALVING_FACTS[3]!.at);
    expect(t.daysSinceLast).toBeGreaterThan(800);
    expect(t.cycleProgress).toBeGreaterThan(0.5);
    expect(t.cycleProgress).toBeLessThanOrEqual(1);
  });

  it('antes del primer halving no se inventa un ciclo anterior', () => {
    const t = halvingTiming(Date.parse('2012-01-01T00:00:00Z'));
    expect(t.lastHalvingDate).toBe(HALVING_FACTS[3]!.at); // no hay ninguno pasado
    expect(t.daysSinceLast).toBe(0);
  });
});

describe('Indicadores técnicos', () => {
  const subida = Array.from({ length: 300 }, (_, i) => 100 + i);
  const bajada = Array.from({ length: 300 }, (_, i) => 400 - i);
  const plano = Array.from({ length: 300 }, () => 100);

  it('sma devuelve null si no hay puntos suficientes', () => {
    expect(sma([1, 2, 3], 50)).toBeNull();
    expect(sma(subida, 50)).toBeCloseTo(374.5, 1);
  });

  it('rsi marca 100 en subida continua y baja en caída continua', () => {
    expect(rsi(subida)).toBe(100);
    expect(rsi(bajada)!).toBeLessThan(5);
    expect(rsi([1, 2])).toBeNull();
  });

  it('la volatilidad de una serie plana es cero', () => {
    expect(realizedVolatility(plano, 30)).toBe(0);
    expect(realizedVolatility([1, 2], 30)).toBeNull();
  });

  it('returnOver calcula el rendimiento del periodo', () => {
    expect(returnOver([100, 110], 1)).toBe(10);
    expect(returnOver([100, 50], 1)).toBe(-50);
    expect(returnOver([100], 30)).toBeNull();
  });

  it('positionInRange se limita a 0-100', () => {
    expect(positionInRange(50, 0, 100)).toBe(50);
    expect(positionInRange(-20, 0, 100)).toBe(0);
    expect(positionInRange(500, 0, 100)).toBe(100);
    expect(positionInRange(50, 100, 100)).toBeNull(); // rango inválido
  });

  it('maCross identifica el cruce y tolera medias ausentes', () => {
    expect(maCross(120, 100)).toBe('golden');
    expect(maCross(90, 100)).toBe('death');
    expect(maCross(null, 100)).toBe('ninguno');
  });

  it('computeTechnicals deja en null lo que no puede calcular, sin inventar', () => {
    // 300 cierres: llega para la media de 200 días, no para la de 200 semanas.
    const t = computeTechnicals(subida);
    expect(t.samples).toBe(300);
    expect(t.sma200).not.toBeNull();
    expect(t.sma200w).toBeNull(); // necesita 1.400 cierres
    expect(t.return365d).toBeNull(); // necesita más de un año
    expect(t.return90d).not.toBeNull();
  });

  it('acota el ciclo actual con cycleStartIndex', () => {
    const t = computeTechnicals(subida, { cycleStartIndex: 250 });
    expect(t.cycleLow).toBe(350); // 100 + 250
    expect(t.cycleHigh).toBe(399);
  });
});
