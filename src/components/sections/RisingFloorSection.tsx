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
import type { MarketData } from '@/types';
import { formatCompact, formatUsd } from '@/lib/format';
import { ChartCard } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';

interface SectionProps {
  data: MarketData;
}

export function RisingFloorSection({ data }: SectionProps) {
  const lows = data.yearlyLows;
  const first = lows[0];
  const last = lows[lows.length - 1];
  const subida = Math.round((last.low / first.low - 1) * 100);
  // Máximo del ciclo anterior (2021) para comparar con el mínimo actual.
  const prevCycleTop = 69000;

  return (
    <div className="space-y-6">
      <ChartCard
        title="El suelo sigue subiendo"
        subtitle="El mínimo anual de Bitcoin aumenta ciclo tras ciclo"
        info="El 'suelo' es el precio más bajo de cada año. Que suba indica que cada nueva base es más alta que la anterior."
        conclusion={
          <>
            El mínimo de {last.year} ({formatUsd(last.low)}) supera el máximo de 2021 (
            {formatUsd(prevCycleTop)}). Es decir: <span className="font-semibold text-bull">el
            suelo de este ciclo está por encima del techo del anterior.</span>
          </>
        }
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={lows} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
              <defs>
                <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.75} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="year" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickFormatter={formatCompact}
                width={48}
              />
              <Tooltip content={<ChartTooltip titleKey="year" formatter={formatUsd} />} />
              <ReferenceLine
                y={prevCycleTop}
                stroke="#22c55e"
                strokeDasharray="5 5"
                label={{ value: 'Máx. 2021', fill: '#22c55e', fontSize: 11, position: 'insideTopRight' }}
              />
              <Area
                type="monotone"
                dataKey="low"
                name="Mínimo anual"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fill="url(#floorGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label={`Mínimo ${first.year}`} value={formatUsd(first.low)} tone="neutral" />
        <MetricCard label={`Mínimo ${last.year}`} value={formatUsd(last.low)} tone="btc" />
        <MetricCard label="Subida del suelo" value={`+${formatCompact(subida)}%`} tone="bull" />
      </div>

      <InsightCard rgb="34,197,94" title="💡 Idea clave">
        Mientras los mínimos sigan marcando suelos más altos, la estructura de largo plazo
        permanece intacta. Es uno de los argumentos a favor de la tesis de «caídas como
        oportunidad» — siempre dentro de un horizonte amplio y asumiendo la volatilidad.
      </InsightCard>
    </div>
  );
}
