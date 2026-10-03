import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { SegmentedControl } from '@/components/ui/Controls';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { useBreadthHistory } from '@/hooks/useBreadthHistory';
import { downsamplePricePoints } from '@/lib/downsample';
import { THRESHOLDS } from '@/lib/altseason/config';
import { formatNumberEs } from '@/lib/format';
import type { AltseasonPeriod, BreadthPoint } from '@/types/altseason';

// =============================================================================
// Evolución de la AMPLITUD: para cada día, qué porcentaje de altcoins superaba
// a Bitcoin en los 90 días previos.
//
// Dos fuentes, según el rango:
//   · 90 días: el universo real del Altseason Score (las altcoins grandes de
//     hoy, con sus velas de exchange). Es la cifra que entra en el score.
//   · 1 año y desde 2017: una cesta fija de altcoins grandes con años de precio
//     diario (Coin Metrics). Con ella se ven las altseasons anteriores, que se
//     marcan en verde: la media de 7 días en el 75% o más durante dos semanas o
//     más, el umbral clásico del Altcoin Season Index.
//
// El Altseason Score completo no se dibuja hacia atrás porque la dominancia y
// el volumen de cada día pasado no los publica ninguna API gratuita.
// =============================================================================

type Range = '90' | '365' | 'todo';

const RANGES: { value: Range; label: string }[] = [
  { value: '90', label: '90 d' },
  { value: '365', label: '1 año' },
  { value: 'todo', label: 'Desde 2017' },
];

const DAY = 86_400_000;
const ALTSEASON = 75;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesAño = (t: number) => {
  const d = new Date(t);
  return `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
};
const año = (t: number) => String(new Date(t).getUTCFullYear());
const fechaLarga = (t: number) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(t));
const ms = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** Media móvil de 7 días: la serie diaria de una cesta pequeña es ruidosa. */
function media7(v: number[]): number[] {
  return v.map((_, i) => {
    const s = v.slice(Math.max(0, i - 6), i + 1);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });
}

/**
 * Una marca por año o por mes, en su primer día y sin repetir etiqueta. El
 * primer punto solo lleva marca si cae al principio de su periodo: la serie
 * empieza en mayo de 2017, y «2017» quedaba encima de «2018».
 */
function marcas(points: { t: number }[], etiqueta: (t: number) => string, max: number, porAño: boolean): number[] {
  const alInicio = (t: number) => (porAño ? new Date(t).getUTCMonth() === 0 : new Date(t).getUTCDate() <= 7);
  const primeras = points
    .filter((p, i) => (i === 0 ? alInicio(p.t) : etiqueta(p.t) !== etiqueta(points[i - 1]!.t)))
    .map((p) => p.t);
  const cada = Math.ceil(primeras.length / max);
  return primeras.filter((_, i) => i % cada === 0);
}

export function AltseasonBreadthChart({
  points,
  defaultOpen = true,
}: {
  points: BreadthPoint[];
  defaultOpen?: boolean;
}) {
  const [range, setRange] = useState<Range>('todo');
  const largo = range !== '90';
  const hist = useBreadthHistory(largo);
  const h = hist.data?.data ?? null;

  const data = useMemo(() => {
    if (!largo) {
      return downsamplePricePoints(
        points.slice(-90).map((p) => ({ t: p.t, price: p.outperformPct })),
        400,
      ).map((p) => ({ t: p.t, v: p.price }));
    }
    if (!h) return [];
    const t0 = ms(h.desde);
    const suave = media7(h.pct);
    const todos = suave.map((v, i) => ({ t: t0 + i * DAY, price: v }));
    const slice = range === '365' ? todos.slice(-365) : todos;
    return downsamplePricePoints(slice, 500).map((p) => ({ t: p.t, v: Number(p.price.toFixed(1)) }));
  }, [largo, points, h, range]);

  const desdeVista = data[0]?.t ?? 0;
  const periodos: AltseasonPeriod[] = largo && h ? h.periodos : [];
  const enVista = periodos.filter((p) => ms(p.hasta) >= desdeVista);
  const etiqueta = range === 'todo' ? año : mesAño;
  const ticks = marcas(data, etiqueta, range === 'todo' ? 12 : 6, range === 'todo');

  return (
    <CollapsibleCard
      title="Evolución de la amplitud"
      titleClassName="text-primary"
      subtitle={largo ? 'Altseasons anteriores marcadas en verde' : 'Altcoins que superan a Bitcoin a 90 días'}
      defaultOpen={defaultOpen}
      info="Porcentaje de altcoins que superaban a Bitcoin en los 90 días previos, día a día. En 90 días es el universo real del Altseason Score (el componente de mayor peso, un 30%). En 1 año y desde 2017, una cesta fija de altcoins grandes con años de historia, en media de 7 días; las zonas verdes son altseasons: la cesta en el 75% o más durante dos semanas o más."
    >
      <div className="mb-3">
        <SegmentedControl<Range> size="sm" value={range} onChange={setRange} options={RANGES} />
      </div>

      {largo && hist.isLoading ? (
        <Skeleton className="h-52 sm:h-64" />
      ) : data.length < 2 ? (
        <p className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 text-center text-sm text-muted">
          {largo
            ? 'El histórico largo no está disponible ahora mismo. Vuelve solo en cuanto responda la fuente.'
            : 'Histórico no disponible: hacen falta al menos 90 días de velas para calcular la serie.'}
        </p>
      ) : (
        <div className="h-52 min-w-0 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id="breadthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              {/* Altseasons anteriores: zonas verdes. */}
              {enVista.map((p) => (
                <ReferenceArea
                  key={p.desde}
                  x1={Math.max(ms(p.desde), desdeVista)}
                  x2={ms(p.hasta)}
                  fill="#22c55e"
                  fillOpacity={0.2}
                  ifOverflow="hidden"
                />
              ))}
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={ticks}
                interval={0}
                tickFormatter={etiqueta}
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                width={40}
              />
              {/* 50% = mitad del mercado bate a BTC. */}
              <ReferenceLine y={50} stroke="var(--text-muted)" strokeDasharray="4 4" />
              <ReferenceLine
                y={largo ? ALTSEASON : THRESHOLDS.outperformStrong}
                stroke="#22c55e"
                strokeDasharray="2 4"
                label={{
                  value: largo ? `${ALTSEASON}% · altseason` : `${THRESHOLDS.outperformStrong}%`,
                  fill: '#22c55e',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--tooltip-bg)',
                  border: '1px solid var(--tooltip-border)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelFormatter={(t) => fechaLarga(Number(t))}
                formatter={(v: number | string) => [
                  `${formatNumberEs(Number(v), 0)}%`,
                  largo ? 'Superan a BTC (media 7 d)' : 'Superan a BTC',
                ]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="#22c55e"
                strokeWidth={largo ? 1.6 : 2}
                fill="url(#breadthGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {largo && h && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold text-secondary">Altseasons {range === 'todo' ? 'desde 2017' : 'en el último año'}</p>
          {enVista.length === 0 ? (
            <p className="text-[11px] text-muted">
              Ninguna en este periodo: la cesta no se ha mantenido en el {ALTSEASON}% o más durante dos semanas.
            </p>
          ) : (
            <ul className="space-y-1 text-[11px] text-muted">
              {[...enVista].reverse().map((p) => (
                <li key={p.desde} className="flex items-start gap-1.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-bull" />
                  <span>
                    <span className="font-semibold text-secondary">
                      {fechaLarga(ms(p.desde))} – {p.enCurso ? 'en curso' : fechaLarga(ms(p.hasta))}
                    </span>{' '}
                    · {formatNumberEs(Math.round((ms(p.hasta) - ms(p.desde)) / DAY) + 1)} días · hasta el {p.maximo}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {largo
          ? `Cesta fija de altcoins grandes con historia (Coin Metrics, dato diario): cada día cuentan solo las que ya cotizaban, de ${h?.activos.inicio ?? '—'} al principio a ${h?.activos.fin ?? '—'} hoy. Ojo: son las que siguen siendo grandes hoy; las que desaparecieron no están.`
          : 'Universo real del Altseason Score. Por encima del 50%, más de la mitad de las altcoins analizadas bate a Bitcoin.'}
      </p>
    </CollapsibleCard>
  );
}
