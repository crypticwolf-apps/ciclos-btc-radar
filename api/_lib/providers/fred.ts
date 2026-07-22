import { z } from 'zod';
import { fetchJson } from '../http';
import { swr } from '../cache';
import { metaFromCache, metaLocked, type ProviderResult } from '../respond';
import { readEnv } from '../runtimeEnv';

// =============================================================================
// Proveedor: FRED (Federal Reserve Economic Data). Requiere FRED_API_KEY en el
// servidor. 9 series macro con su fecha REAL de observación y frecuencia.
// Sin clave → tarjeta bloqueada (no inventamos valores).
// =============================================================================

const ObsSchema = z.object({
  observations: z.array(z.object({ date: z.string(), value: z.string() })),
});

interface Point {
  date: string;
  value: number;
}

export type MacroFrequency = 'diaria' | 'semanal' | 'mensual';

export interface MacroSeries {
  id: string;
  fredId: string;
  label: string;
  value: number;
  unit: string;
  observedAt: string; // fecha real de la observación (YYYY-MM-DD)
  frequency: MacroFrequency;
  change: number | null;
  changeLabel: string;
  definicion: string;
}

export interface MacroData {
  series: MacroSeries[];
}

interface SeriesDef {
  id: string;
  fredId: string;
  label: string;
  unit: string;
  frequency: MacroFrequency;
  limit: number;
  definicion: string;
  compute: (p: Point[]) => { value: number; change: number | null; changeLabel: string };
}

const pct = (a: number, b: number) => Number((((a - b) / b) * 100).toFixed(2));
const diff = (a: number, b: number) => Number((a - b).toFixed(2));

const DEFS: SeriesDef[] = [
  {
    id: 'fedfunds', fredId: 'FEDFUNDS', label: 'Tipos de interés (Fed)', unit: '%',
    frequency: 'mensual', limit: 6,
    definicion: 'Tipo efectivo de los fondos federales de la Reserva Federal de EE. UU.',
    compute: (p) => ({ value: p[0]!.value, change: p[1] ? diff(p[0]!.value, p[1].value) : null, changeLabel: 'vs mes previo' }),
  },
  {
    id: 'inflacion', fredId: 'CPIAUCSL', label: 'Inflación (CPI)', unit: '% interanual',
    frequency: 'mensual', limit: 14,
    definicion: 'Índice de precios al consumidor de EE. UU.; mostramos la variación interanual.',
    compute: (p) => ({ value: p.length > 12 ? pct(p[0]!.value, p[12]!.value) : NaN, change: null, changeLabel: 'interanual' }),
  },
  {
    id: 'desempleo', fredId: 'UNRATE', label: 'Desempleo EE. UU.', unit: '%',
    frequency: 'mensual', limit: 6,
    definicion: 'Tasa de desempleo de EE. UU.',
    compute: (p) => ({ value: p[0]!.value, change: p[1] ? diff(p[0]!.value, p[1].value) : null, changeLabel: 'vs mes previo' }),
  },
  {
    id: 'treasury10y', fredId: 'DGS10', label: 'Treasury 10 años', unit: '%',
    frequency: 'diaria', limit: 30,
    definicion: 'Rendimiento del bono del Tesoro de EE. UU. a 10 años.',
    compute: (p) => ({ value: p[0]!.value, change: p[5] ? diff(p[0]!.value, p[5].value) : null, changeLabel: 'vs ~1 sem' }),
  },
  {
    id: 'spread', fredId: 'T10Y2Y', label: 'Spread 10A–2A', unit: 'pp',
    frequency: 'diaria', limit: 30,
    definicion: 'Diferencial entre el Treasury a 10 y a 2 años; negativo = curva invertida.',
    compute: (p) => ({ value: p[0]!.value, change: p[5] ? diff(p[0]!.value, p[5].value) : null, changeLabel: 'vs ~1 sem' }),
  },
  {
    id: 'dolar', fredId: 'DTWEXBGS', label: 'Dólar (índice broad)', unit: 'índice',
    frequency: 'diaria', limit: 70,
    definicion: 'Índice del dólar estadounidense ponderado por comercio (broad).',
    compute: (p) => ({ value: p[0]!.value, change: p.length > 60 ? pct(p[0]!.value, p[60]!.value) : null, changeLabel: 'vs ~3 meses' }),
  },
  {
    id: 'liquidez', fredId: 'M2SL', label: 'Masa monetaria (M2)', unit: '% interanual',
    frequency: 'mensual', limit: 14,
    definicion: 'Agregado monetario M2 de EE. UU.; mostramos la variación interanual.',
    compute: (p) => ({ value: p.length > 12 ? pct(p[0]!.value, p[12]!.value) : NaN, change: null, changeLabel: 'interanual' }),
  },
  {
    id: 'sp500', fredId: 'SP500', label: 'S&P 500', unit: 'índice',
    frequency: 'diaria', limit: 30,
    definicion: 'Índice bursátil S&P 500.',
    compute: (p) => ({ value: p[0]!.value, change: p[5] ? pct(p[0]!.value, p[5].value) : null, changeLabel: 'vs ~1 sem' }),
  },
  {
    id: 'vix', fredId: 'VIXCLS', label: 'VIX (volatilidad)', unit: 'índice',
    frequency: 'diaria', limit: 10,
    definicion: 'Índice de volatilidad implícita del S&P 500; alto = aversión al riesgo.',
    compute: (p) => ({ value: p[0]!.value, change: p[1] ? diff(p[0]!.value, p[1].value) : null, changeLabel: 'vs día previo' }),
  },
];

async function fetchSeries(def: SeriesDef): Promise<MacroSeries> {
  const key = readEnv('FRED_API_KEY');
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${def.fredId}` +
    `&api_key=${key}&file_type=json&sort_order=desc&limit=${def.limit}`;
  const raw = await fetchJson<unknown>(url, { provider: `fred:${def.fredId}`, timeoutMs: 9000 });
  const points: Point[] = ObsSchema.parse(raw)
    .observations.map((o) => ({ date: o.date, value: o.value === '.' ? NaN : Number(o.value) }))
    .filter((o) => !Number.isNaN(o.value));
  if (points.length === 0) throw new Error(`serie ${def.fredId} vacía`);
  const { value, change, changeLabel } = def.compute(points);
  return {
    id: def.id, fredId: def.fredId, label: def.label, unit: def.unit,
    value: Number.isFinite(value) ? Number(value.toFixed(2)) : NaN,
    observedAt: points[0]!.date, frequency: def.frequency,
    change, changeLabel, definicion: def.definicion,
  };
}

export function macroConfigured(): boolean {
  return Boolean(readEnv('FRED_API_KEY'));
}

export async function getMacro(): Promise<ProviderResult<MacroData>> {
  if (!readEnv('FRED_API_KEY')) {
    return {
      data: { series: [] },
      meta: metaLocked('fred', 'Configura FRED_API_KEY en el servidor para el bloque macro.'),
    };
  }
  // Cache 6h; FRED publica con baja frecuencia.
  const r = await swr('macro:fred', { ttlMs: 6 * 60 * 60_000, staleMs: 24 * 60 * 60_000 }, async () => {
    const results = await Promise.allSettled(DEFS.map(fetchSeries));
    const series = results
      .filter((x): x is PromiseFulfilledResult<MacroSeries> => x.status === 'fulfilled')
      .map((x) => x.value);
    if (series.length === 0) throw new Error('FRED no devolvió ninguna serie');
    return { series } satisfies MacroData;
  });
  return { data: r.value, meta: metaFromCache('fred', r.status, r.storedAt) };
}
