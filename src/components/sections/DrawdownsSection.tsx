import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MarketData } from '@/types';
import { formatPercent } from '@/lib/format';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChartCard } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { TrendingDown, Clock, ArrowUp, Activity } from 'lucide-react';

interface SectionProps {
  data: MarketData;
}

export function DrawdownsSection({ data }: SectionProps) {
  const { bitcoin } = data;
  const { formatFromUsd } = useCurrency();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Caída desde el ATH"
          value={formatPercent(bitcoin.drawdownDesdeAth)}
          sub={`ATH ${formatFromUsd(bitcoin.ath)}`}
          tone="bear"
          icon={TrendingDown}
          info="Distancia porcentual entre el precio actual y el máximo histórico."
        />
        <MetricCard
          label="Tiempo desde el ATH"
          value={`${bitcoin.diasDesdeAth} días`}
          sub={`Máximo el ${new Date(bitcoin.athFecha).toLocaleDateString('es-ES')}`}
          tone="neutral"
          icon={Clock}
        />
        <MetricCard
          label="Para volver al ATH"
          value={formatPercent(bitcoin.recuperacionNecesaria)}
          sub="Subida necesaria desde aquí"
          tone="bull"
          icon={ArrowUp}
          info="Cuando caes un 50%, necesitas un +100% para recuperarte. Por eso las caídas profundas exigen rallies grandes."
        />
        <MetricCard
          label="Retorno medio anual"
          value="54%"
          sub="2014-2025 (incluye años malos)"
          tone="bull"
          icon={Activity}
          info="Dato histórico citado por BlackRock. No es una previsión."
        />
      </div>

      <ChartCard
        title="Histórico: caídas vs. recuperaciones"
        subtitle="Cada caída brutal ha sido seguida, hasta ahora, por un rally superior al 100%"
        info="En rojo, la caída desde el máximo de cada ciclo. En verde, el rally posterior hasta el siguiente pico."
        conclusion="El patrón histórico es claro: a mayor miedo y mayor caída, mayor ha sido la recuperación posterior. Pero el pasado no garantiza el futuro: el mínimo exacto es impredecible."
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.drawdowns} margin={{ top: 16, right: 48, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="period" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis
                yAxisId="left"
                stroke="#ef4444"
                tick={{ fill: '#ef4444', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                width={44}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#22c55e"
                tick={{ fill: '#22c55e', fontSize: 11 }}
                tickFormatter={(v) => (v ? `${v}%` : '')}
                width={52}
              />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
              <Legend formatter={(v) => <span className="text-muted text-sm">{v}</span>} />
              <Bar yAxisId="left" dataKey="drawdown" name="Caída desde ATH" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="recovery" name="Rally posterior" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['4', 'Caídas mayores al 50%', 'btc'],
          ['100%', 'Han recuperado (hasta hoy)', 'bull'],
          ['+101%', 'Rally mínimo tras -70%', 'bull'],
          [formatPercent(bitcoin.drawdownDesdeAth), 'Caída actual', 'bear'],
        ].map(([v, l, tone]) => (
          <MetricCard key={l} label={l} value={v} tone={tone as 'btc' | 'bull' | 'bear'} />
        ))}
      </div>

      <InsightCard rgb="245,158,11" title="💡 Idea clave (BlackRock)">
        «Desde 2014, Bitcoin fue el activo más rentable en 8 de 11 años. Incluso contando sus 3
        peores años, promedió un 54% anual». Volatilidad extrema, pero con un sesgo histórico al
        alza dentro de horizontes largos.
      </InsightCard>
    </div>
  );
}
