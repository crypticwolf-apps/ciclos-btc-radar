import { describe, it, expect, vi, beforeEach } from 'vitest';

// La capa HTTP y la caché se falsean: lo que se prueba es qué se publica y
// cómo, no la red.
const fetchJson = vi.fn();
vi.mock('../http.js', () => ({ fetchJson: (...args: unknown[]) => fetchJson(...args) }));
vi.mock('../cache.js', () => ({
  swr: async (_key: string, _ttl: unknown, load: () => Promise<unknown>) => ({
    value: await load(),
    status: 'live',
    storedAt: Date.parse('2026-10-03T08:00:00Z'),
  }),
}));
const env: Record<string, string | undefined> = { FRED_API_KEY: 'clave' };
vi.mock('../runtimeEnv.js', () => ({ readEnv: (k: string) => env[k] }));

const { DEFS, getMacro, netLiquidity, scaleToBillions, summarize, yoy } = await import('./fred.js');

/** Serie mensual ascendente desde `start` (YYYY-MM), con un valor por mes. */
function monthly(start: string, values: number[]) {
  const [y, m] = start.split('-').map(Number) as [number, number];
  return values.map((value, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    return { date: d.toISOString().slice(0, 10), value };
  });
}

/** Serie diaria ascendente que termina el `end`, con `n` días. */
function daily(end: string, n: number, f: (i: number) => number) {
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(endMs - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    value: f(i),
  }));
}

const def = (id: string) => DEFS.find((d) => d.id === id)!;

describe('variación interanual', () => {
  it('compara con el MISMO mes del año anterior', () => {
    const s = monthly('2024-01', [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 110, 112]);
    const out = yoy(s);
    // ene 25 frente a ene 24: 110 / 100.
    expect(out[0]).toEqual({ date: '2025-01-01', value: 10 });
    expect(out[1]!.value).toBeCloseTo(10.89, 2);
  });

  it('si falta un mes no compara con el que no toca', () => {
    // Falta marzo de 2024: contar doce posiciones hacia atrás cruzaría meses.
    const s = monthly('2024-01', [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 120, 121, 122]).filter(
      (p) => p.date !== '2024-03-01',
    );
    const marzo25 = yoy(s).find((p) => p.date === '2025-03-01');
    expect(marzo25).toBeUndefined();
  });
});

describe('unidades de FRED', () => {
  it('lleva millones, miles de millones y billones a miles de millones', () => {
    expect(scaleToBillions('Millions of U.S. Dollars')).toBe(0.001);
    expect(scaleToBillions('Billions of U.S. Dollars')).toBe(1);
    expect(scaleToBillions('Trillions of U.S. Dollars')).toBe(1000);
  });

  it('una unidad desconocida se rechaza en vez de suponerla', () => {
    expect(() => scaleToBillions('Index 2015=100')).toThrow(/no reconocida/);
  });
});

describe('liquidez neta de la Fed', () => {
  const walcl = [
    { date: '2026-09-16', value: 6600 },
    { date: '2026-09-23', value: 6580 },
  ];
  const tga = [
    { date: '2026-09-16', value: 800 },
    { date: '2026-09-23', value: 850 },
  ];
  const rrp = [
    { date: '2026-09-15', value: 40 },
    { date: '2026-09-22', value: 30 },
    { date: '2026-09-23', value: 25 },
  ];

  it('resta TGA y RRP de la misma fecha o la anterior más cercana', () => {
    expect(netLiquidity(walcl, tga, rrp)).toEqual([
      { date: '2026-09-16', value: 5760 },
      { date: '2026-09-23', value: 5705 },
    ]);
  });

  it('no publica una cifra fuera de rango: delataría un error de unidades', () => {
    // Balance leído en millones sin escalar: 6.600.000 «miles de millones».
    const mal = walcl.map((p) => ({ ...p, value: p.value * 1000 }));
    expect(() => netLiquidity(mal, tga, rrp)).toThrow(/fuera de rango/);
  });
});

describe('resumen de un indicador', () => {
  it('mensual: compara con el dato publicado justo antes', () => {
    const s = summarize(def('desempleo'), monthly('2025-09', [4.1, 4.2, 4.2, 4.3, 4.4]), 'x');
    expect(s.value).toBe(4.4);
    expect(s.previous).toBe(4.3);
    expect(s.previousAt).toBe('2025-12-01');
    expect(s.change).toBe(0.1);
    expect(s.changeLabel).toBe('vs mes anterior');
    expect(s.trend).toBe('sube');
  });

  it('diaria: compara con hace un mes, no con ayer', () => {
    const s = summarize(def('vix'), daily('2026-10-02', 100, (i) => 30 - i * 0.12), 'x');
    expect(s.observedAt).toBe('2026-10-02');
    expect(s.changeLabel).toBe('vs hace 1 mes');
    // 30 días atrás son 30 posiciones: 0,12 × 30 = 3,6 puntos menos.
    expect(s.change).toBeCloseTo(-3.6, 1);
    expect(s.trend).toBe('baja');
    // La minigráfica se adelgaza, pero conserva el último punto.
    expect(s.spark.length).toBeLessThanOrEqual(31);
    expect(s.spark[s.spark.length - 1]).toBe(s.value);
  });

  it('dentro del umbral la tendencia es «estable»', () => {
    const s = summarize(def('desempleo'), monthly('2025-06', [4.1, 4.1, 4.15, 4.1, 4.12]), 'x');
    expect(s.trend).toBe('estable');
  });

  it('sin observaciones no inventa un valor', () => {
    expect(() => summarize(def('vix'), [], 'x')).toThrow(/sin valor/);
  });
});

describe('getMacro', () => {
  beforeEach(() => {
    fetchJson.mockReset();
    env.FRED_API_KEY = 'clave';
  });

  /** Respuesta de FRED para una URL: unidades u observaciones (descendentes). */
  function fred(url: string) {
    const id = new URL(url).searchParams.get('series_id')!;
    if (url.includes('/fred/series?')) {
      const units = id === 'RRPONTSYD' ? 'Billions of U.S. Dollars' : 'Millions of U.S. Dollars';
      return { seriess: [{ units }] };
    }
    const n = id === 'RRPONTSYD' ? 160 : 40;
    const weekly = ['WALCL', 'WTREGEN', 'NFCI'].includes(id);
    const monthlySeries = ['M2SL', 'CPIAUCSL', 'UNRATE', 'CFNAIMA3', 'GACDFSA066MSFRBPHI'].includes(id);
    const stepDays = monthlySeries ? 30 : weekly ? 7 : 1;
    const base: Record<string, number> = { WALCL: 6_600_000, WTREGEN: 800_000, RRPONTSYD: 30, M2SL: 21_000, CPIAUCSL: 320 };
    const end = Date.parse('2026-10-01T00:00:00Z');
    const observations = Array.from({ length: n }, (_, i) => ({
      date: new Date(end - i * stepDays * 86_400_000).toISOString().slice(0, 10),
      value: String((base[id] ?? 2) * (1 + 0.001 * (n - i))),
    }));
    return { observations };
  }

  it('publica todos los indicadores con su fecha real y sin huecos', async () => {
    fetchJson.mockImplementation(async (url: string) => fred(url));
    const { data, meta } = await getMacro();

    expect(data.missing).toEqual([]);
    expect(data.series.map((s) => s.id)).toEqual(DEFS.map((d) => d.id));
    for (const s of data.series) {
      expect(Number.isFinite(s.value)).toBe(true);
      expect(s.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.cadence.length).toBeGreaterThan(0);
    }
    // La liquidez neta se calcula en miles de millones: 6.600 − 800 − 30.
    const neta = data.series.find((s) => s.id === 'liquidez-fed')!;
    expect(neta.value).toBeGreaterThan(5000);
    expect(neta.value).toBeLessThan(7000);
    expect(meta.status).toBe('live');
  });

  it('una serie que falla se declara y las demás siguen', async () => {
    fetchJson.mockImplementation(async (url: string) => {
      if (url.includes('GACDFSA066MSFRBPHI')) throw new Error('Bad Request');
      return fred(url);
    });
    const { data, meta } = await getMacro();

    expect(data.series.some((s) => s.id === 'manufactura')).toBe(false);
    expect(data.missing).toEqual([
      expect.objectContaining({ id: 'manufactura', reason: expect.stringContaining('Bad Request') }),
    ]);
    expect(data.series.length).toBe(DEFS.length - 1);
    expect(meta.note).toMatch(/Manufactura/);
  });

  it('sin clave el bloque queda bloqueado, sin datos de relleno', async () => {
    env.FRED_API_KEY = undefined;
    const { data, meta } = await getMacro();
    expect(data.series).toEqual([]);
    expect(meta.status).toBe('locked');
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
