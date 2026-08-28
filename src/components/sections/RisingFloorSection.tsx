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
import { formatCompact } from '@/lib/format';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChartCard } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';

interface SectionProps {
  data: MarketData;
}

export function RisingFloorSection({ data }: SectionProps) {
  const { formatFromUsd, formatCompactFromUsd } = useCurrency();
  const lows = data.yearlyLows;
  const first = lows[0];
  const last = lows[lows.length - 1];

  // Sin serie diaria no hay suelos anuales que dibujar. Leer el primero de una
  // lista vacía tumbaba la vista de Análisis entera.
  if (!first || !last) {
    return (
      <ChartCard
        title="El suelo sigue subiendo"
        subtitle="El mínimo anual de Bitcoin, año a año"
        info="El «suelo» es el precio más bajo de cada año natural."
      >
        <p className="text-sm text-muted">
          La serie histórica de precios no está disponible ahora mismo. Vuelve sola en cuanto
          responda la fuente.
        </p>
      </ChartCard>
    );
  }

  const subida = Math.round((last.low / first.low - 1) * 100);

  // Techo del ciclo anterior, sacado de los propios extremos detectados en la
  // serie. Antes era un 69.000 escrito a mano que se quedaría viejo en cuanto
  // Bitcoin cerrara otro ciclo.
  const picos = data.cyclePrices.filter((p) => p.isPeak && !p.isCurrent);
  const techoAnterior = picos.length ? picos[picos.length - 1]!.price : null;

  return (
    <ChartCard
      title="El suelo sigue subiendo"
      subtitle="El mínimo anual de Bitcoin, año a año"
      info="El «suelo» es el precio más bajo de cada año natural. Que suba indica que cada nueva base queda por encima de la anterior."
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <MetricCard label={`Mínimo ${first.year}`} value={formatFromUsd(first.low)} tone="neutral" />
        <MetricCard label={`Mínimo ${last.year}`} value={formatFromUsd(last.low)} tone="btc" />
        <MetricCard label="Subida del suelo" value={`+${formatCompact(subida)}%`} tone="bull" />
      </div>

      <div className="mt-4 h-64 sm:h-80">
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
              // 66, no 48: «63,6 mil €» no cabía y el eje se comía la primera
              // cifra («3,6 mil €» donde ponía 63,6).
              tickFormatter={(value) => formatCompactFromUsd(Number(value), { maximumFractionDigits: 0 })}
              width={66}
            />
            <Tooltip content={<ChartTooltip titleKey="year" formatter={formatFromUsd} />} />
            {techoAnterior != null && (
              <ReferenceLine
                y={techoAnterior}
                stroke="#22c55e"
                strokeDasharray="5 5"
                label={{ value: 'Techo anterior', fill: '#22c55e', fontSize: 11, position: 'insideTopRight' }}
              />
            )}
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
  );
}
