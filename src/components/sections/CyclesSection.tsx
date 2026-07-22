import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MarketData } from '@/types';
import { formatGrowth } from '@/lib/format';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChartCard, Card } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { SegmentedControl } from '@/components/ui/Controls';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { CyclePhaseDetail } from './shared/CyclePhaseDetail';

interface SectionProps {
  data: MarketData;
}

export function CyclesSection({ data }: SectionProps) {
  const [scale, setScale] = useState<'log' | 'lineal'>('log');
  const log = scale === 'log';
  const { formatFromUsd, formatCompactFromUsd } = useCurrency();

  return (
    <div className="space-y-6">
      <ChartCard
        title="Los ciclos de Bitcoin"
        subtitle="De céntimos a máximos de seis cifras a lo largo de 15 años"
        info="Cada ciclo combina un suelo, una expansión, un pico de euforia y una corrección. Los halvings marcan el ritmo."
        action={
          <SegmentedControl<'log' | 'lineal'>
            size="sm"
            value={scale}
            onChange={setScale}
            options={[
              { value: 'log', label: 'Log' },
              { value: 'lineal', label: 'Lineal' },
            ]}
          />
        }
        conclusion="Cada ciclo ha tenido caídas brutales seguidas de nuevos máximos. La escala logarítmica revela un patrón de crecimiento por etapas, no una línea recta."
      >
        <div className="h-64 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.cyclePrices} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
              <defs>
                <linearGradient id="cycleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis
                dataKey="year"
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={64}
              />
              <YAxis
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                scale={log ? 'log' : 'linear'}
                domain={log ? [0.1, 200000] : [0, 140000]}
                tickFormatter={(value) => formatCompactFromUsd(Number(value))}
                width={42}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    titleKey="year"
                    renderBody={(d) => (
                      <div>
                        <p className="font-mono text-base font-bold text-primary">
                          {formatFromUsd(Number(d.price))}
                        </p>
                        <p className="text-xs text-muted">
                          Ciclo {String(d.cycle)} · {String(d.phase)}
                        </p>
                      </div>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fill="url(#cycleGrad)"
                dot={(props) => {
                  const { cx, cy, payload, index } = props;
                  if (payload.isPeak)
                    return <circle key={index} cx={cx} cy={cy} r={6} fill="#22c55e" stroke="#fff" strokeWidth={1.5} />;
                  if (payload.isBottom)
                    return <circle key={index} cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />;
                  if (payload.isCurrent)
                    return <circle key={index} cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#fff" strokeWidth={2} className="animate-pulse" />;
                  return <circle key={index} cx={cx} cy={cy} r={3} fill="#f59e0b" />;
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <Legend />
      </ChartCard>

      <Card>
        <h3 className="mb-4 text-lg font-bold text-btc">Rendimiento por ciclo (de suelo a pico)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.cycleComparison.map((c) => (
            <div
              key={c.cycle}
              className="rounded-xl border p-4 text-center transition-transform hover:-translate-y-1"
              style={
                c.current
                  ? { background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.4)' }
                  : { background: 'var(--surface)', borderColor: 'var(--surface-border)' }
              }
            >
              <p className="mb-1 whitespace-pre-line text-[11px] text-muted">{c.cycle}</p>
              <p className="font-mono text-2xl font-bold" style={{ color: c.color }}>
                {formatGrowth(c.growth)}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {formatCompactFromUsd(c.min)} → {formatCompactFromUsd(c.max)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-lg font-bold text-btc">🔥 Los halvings: el motor de los ciclos</h3>
        <p className="mb-4 text-sm text-muted">
          Cada ~4 años la emisión se reduce a la mitad. El pico suele llegar 12-18 meses después.
        </p>
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:thin]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                <th className="px-3 py-2 font-medium">Halving</th>
                <th className="px-3 py-2 text-center font-medium">Recompensa</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Precio</th>
                <th className="px-3 py-2 text-right font-medium">Pico 18m</th>
                <th className="px-3 py-2 text-right font-medium">Retorno</th>
              </tr>
            </thead>
            <tbody>
              {data.halvings.map((h) => {
                const ret = h.priceAfter18m
                  ? Math.round((h.priceAfter18m / h.priceAtHalving - 1) * 100)
                  : null;
                return (
                  <tr key={h.year} className="border-b border-white/5">
                    <td className="px-3 py-3 font-medium text-primary">
                      {h.year}
                      <span className="ml-2 hidden text-xs text-muted md:inline">#{h.block}</span>
                    </td>
                    <td className="px-3 py-3 text-center text-muted">{h.reward}</td>
                    <td className="hidden px-3 py-3 text-right text-secondary sm:table-cell">
                      {formatFromUsd(h.priceAtHalving)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-bull">
                      {h.priceAfter18m ? formatFromUsd(h.priceAfter18m) : '¿?'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {ret != null ? (
                        <span className="font-bold text-bull">+{ret.toLocaleString('es-ES')}%</span>
                      ) : (
                        <span className="animate-pulse font-medium text-btc">En curso…</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <CyclePhaseDetail fase={data.fase} expanded />

      <InsightCard rgb="245,158,11" title="💡 Idea clave">
        Los halvings reducen la oferta nueva justo cuando suele crecer la demanda. No garantizan
        nada, pero históricamente han precedido a las grandes expansiones de cada ciclo.
      </InsightCard>
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ['#22c55e', 'Picos'],
    ['#ef4444', 'Suelos'],
    ['#f59e0b', 'Actual'],
  ];
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-5 text-sm">
      {items.map(([c, l]) => (
        <div key={l} className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: c }} />
          <span className="text-muted">{l}</span>
        </div>
      ))}
    </div>
  );
}
