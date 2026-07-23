import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/Controls';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { downsamplePricePoints } from '@/lib/downsample';
import { THRESHOLDS } from '@/lib/altseason/config';
import type { BreadthPoint } from '@/types/altseason';

// =============================================================================
// Evolución histórica de la AMPLITUD: para cada día, qué porcentaje de las
// altcoins analizadas superaba a Bitcoin en los 90 días previos.
//
// Por qué esta serie y no el histórico del Altseason Score completo: el score
// necesita dominancia, volumen y stablecoins de CADA día pasado, y ninguna API
// gratuita publica ese histórico. Esta serie sí es 100% real —se recalcula
// desde las velas diarias— y es el componente de mayor peso del score (30%),
// así que es la mejor aproximación honesta a su evolución.
// =============================================================================

type Range = '30' | '90' | 'max';

const RANGES: { value: Range; label: string }[] = [
  { value: '30', label: '30 d' },
  { value: '90', label: '90 d' },
  { value: 'max', label: 'MÁX' },
];

export function AltseasonBreadthChart({ points }: { points: BreadthPoint[] }) {
  const [range, setRange] = useState<Range>('90');

  const data = useMemo(() => {
    if (points.length === 0) return [];
    const days = range === 'max' ? points.length : Number(range);
    const slice = points.slice(-days);
    // Se reutiliza el downsampling ya probado del proyecto (conserva primer y
    // último punto y los extremos de cada tramo) mapeando al shape que espera.
    return downsamplePricePoints(
      slice.map((p) => ({ t: p.t, price: p.outperformPct })),
      400,
    ).map((p) => ({ t: p.t, outperformPct: p.price }));
  }, [points, range]);

  if (points.length === 0) {
    return (
      <Card className="!p-4">
        <h2 className="text-base font-bold text-primary">Evolución de la amplitud</h2>
        <p className="mt-2 text-sm text-muted">
          Histórico no disponible: hacen falta al menos 90 días de velas para calcular la serie.
        </p>
      </Card>
    );
  }

  const fmtDate = (t: number) =>
    new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(t));

  return (
    <Card className="!p-4 sm:!p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-bold text-primary sm:text-lg">
          Evolución de la amplitud
          <InfoTooltip text="Porcentaje de altcoins que superaban a Bitcoin en los 90 días previos, calculado día a día sobre velas reales. Es el componente de mayor peso del Altseason Score (30%)." />
        </h2>
        <SegmentedControl<Range> size="sm" value={range} onChange={setRange} options={RANGES} />
      </div>

      <div className="h-52 min-w-0 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id="breadthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis
              dataKey="t"
              tickFormatter={fmtDate}
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              minTickGap={44}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
              width={34}
            />
            {/* 50% = mitad del mercado bate a BTC; por encima, rotación real */}
            <ReferenceLine y={50} stroke="var(--text-muted)" strokeDasharray="4 4" />
            <ReferenceLine
              y={THRESHOLDS.outperformStrong}
              stroke="#22c55e"
              strokeDasharray="2 4"
              label={{
                value: `${THRESHOLDS.outperformStrong}%`,
                fill: '#22c55e',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated, #1a1a1a)',
                border: '1px solid var(--grid-line)',
                borderRadius: 12,
                fontSize: 12,
              }}
              labelFormatter={(t) =>
                new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(Number(t)))
              }
              formatter={(v: number | string) => [`${Number(v).toFixed(0)}%`, 'Superan a BTC']}
            />
            <Area
              type="monotone"
              dataKey="outperformPct"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#breadthGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Por encima del 50% significa que más de la mitad de las altcoins analizadas batía a Bitcoin.
        No se dibuja el histórico del score completo porque la dominancia y el volumen de cada día
        pasado no los publica ninguna API gratuita.
      </p>
    </Card>
  );
}
