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
import { MetricCard } from '@/components/ui/MetricCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { TrendingDown, Clock, ArrowUp } from 'lucide-react';

interface SectionProps {
  data: MarketData;
}

export function DrawdownsSection({ data }: SectionProps) {
  const { bitcoin } = data;
  const { formatFromUsd } = useCurrency();

  // Resumen del histórico, contado sobre la propia serie. Antes eran cuatro
  // cifras escritas a mano («4 caídas», «100% han recuperado», «+101%») que no
  // se movían aunque cambiara el histórico ni cuando la caída actual empeoraba.
  const cerradas = data.drawdowns.filter((d) => !d.current);
  const profundas = cerradas.filter((d) => d.drawdown <= -50);
  const recuperadas = cerradas.filter((d) => d.recovery != null);
  const rallyMinimo = recuperadas.length
    ? Math.min(...recuperadas.map((d) => d.recovery!))
    : null;

  return (
    <ChartCard
      title="Caídas y recuperaciones"
      subtitle="Cuánto ha caído Bitcoin en cada ciclo y qué vino después"
      info="En rojo, la caída desde el máximo de cada ciclo. En verde, el rally posterior hasta el siguiente pico. La barra «Actual» es una caída todavía abierta: no tiene rally que contar."
    >
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
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
          label="Caídas de más del 50%"
          value={String(profundas.length)}
          sub={`de ${cerradas.length} ciclos cerrados`}
          tone="btc"
          info="Caídas ya cerradas: las que llegaron a suelo y encadenaron un nuevo máximo. La caída en curso no cuenta aquí."
        />
      </div>

      <div className="mt-4 h-64 sm:h-80">
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

      {cerradas.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          <MetricCard
            label="Caídas ya recuperadas"
            value={`${recuperadas.length}/${cerradas.length}`}
            tone={recuperadas.length === cerradas.length ? 'bull' : 'neutral'}
          />
          <MetricCard
            label="Rally más flojo"
            value={rallyMinimo == null ? '—' : `+${Math.round(rallyMinimo).toLocaleString('es-ES')}%`}
            sub="El menor de los rebotes medidos"
            tone="bull"
          />
        </div>
      )}
    </ChartCard>
  );
}
