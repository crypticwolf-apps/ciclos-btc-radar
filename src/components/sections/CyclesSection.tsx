import { useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown } from 'lucide-react';
import type { MarketData } from '@/types';
import { formatGrowth } from '@/lib/format';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChartCard, Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/Controls';
import { HalvingCountdown } from '@/components/ui/HalvingCountdown';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { CyclePhaseDetail } from './shared/CyclePhaseDetail';

export function CyclesSection({ data }: { data: MarketData }) {
  const [scale, setScale] = useState<'log' | 'lineal'>('log');
  const log = scale === 'log';
  const { formatFromUsd, formatCompactFromUsd } = useCurrency();

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ChartCard
          title="Los ciclos de Bitcoin"
          subtitle="Histórico de suelos, expansiones y picos"
          info="La escala logarítmica permite comparar ciclos con precios muy diferentes."
          action={
            <SegmentedControl<'log' | 'lineal'>
              size="sm"
              value={scale}
              onChange={setScale}
              options={[{ value: 'log', label: 'Log' }, { value: 'lineal', label: 'Lineal' }]}
            />
          }
          conclusion="Los halvings han marcado el ritmo histórico, aunque cada ciclo reduce su rendimiento porcentual y no garantiza que el patrón se repita."
        >
          <div className="h-64 min-w-0 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.cyclePrices} margin={{ top: 12, right: 4, left: 0, bottom: 2 }}>
                <defs>
                  <linearGradient id="cycleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                <XAxis dataKey="year" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} minTickGap={26} />
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} scale={log ? 'log' : 'linear'} domain={log ? [0.1, 200000] : [0, 140000]} tickFormatter={(value) => formatCompactFromUsd(Number(value))} width={44} />
                <Tooltip content={<ChartTooltip titleKey="year" renderBody={(point) => (
                  <div>
                    <p className="font-mono text-base font-bold text-primary">{formatFromUsd(Number(point.price))}</p>
                    <p className="text-xs text-muted">Ciclo {String(point.cycle)} · {String(point.phase)}</p>
                  </div>
                )} />} />
                <Area type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2.5} fill="url(#cycleGrad)" dot={(props) => {
                  const { cx, cy, payload, index } = props;
                  if (payload.isPeak) return <circle key={index} cx={cx} cy={cy} r={5} fill="#22c55e" stroke="#fff" strokeWidth={1.5} />;
                  if (payload.isBottom) return <circle key={index} cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />;
                  if (payload.isCurrent) return <circle key={index} cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />;
                  return <circle key={index} cx={cx} cy={cy} r={2.5} fill="#f59e0b" />;
                }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Legend />
        </ChartCard>
        <HalvingCountdown info={data.halvingInfo} />
      </div>

      <AccordionCard title="Comparación de rendimiento por ciclo" subtitle="De suelo a pico">
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.cycleComparison.map((cycle) => (
            <div key={cycle.cycle} className="rounded-xl border p-3 text-center" style={cycle.current ? { background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.4)' } : { background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <p className="whitespace-pre-line text-[10px] text-muted">{cycle.cycle}</p>
              <p className="font-mono text-xl font-bold" style={{ color: cycle.color }}>{formatGrowth(cycle.growth)}</p>
              <p className="text-[10px] text-muted">{formatCompactFromUsd(cycle.min)} → {formatCompactFromUsd(cycle.max)}</p>
            </div>
          ))}
        </div>
      </AccordionCard>

      <AccordionCard title="Histórico de halvings" subtitle="Emisión, precio y retorno posterior">
        <div className="grid gap-2 pt-3 sm:hidden">
          {data.halvings.map((halving) => <HalvingMobileCard key={halving.year} halving={halving} formatFromUsd={formatFromUsd} />)}
        </div>
        <table className="mt-3 hidden w-full table-fixed text-sm sm:table">
          <thead><tr className="border-b border-white/10 text-left text-xs text-muted">
            <th className="py-2">Halving</th><th className="py-2 text-center">Recompensa</th><th className="py-2 text-right">Precio</th><th className="py-2 text-right">Pico 18m</th><th className="py-2 text-right">Retorno</th>
          </tr></thead>
          <tbody>{data.halvings.map((halving) => {
            const ret = halving.priceAfter18m ? Math.round((halving.priceAfter18m / halving.priceAtHalving - 1) * 100) : null;
            return <tr key={halving.year} className="border-b border-white/5">
              <td className="py-3 font-medium text-primary">{halving.year}</td><td className="py-3 text-center text-muted">{halving.reward}</td><td className="py-3 text-right text-secondary">{formatFromUsd(halving.priceAtHalving)}</td><td className="py-3 text-right font-medium text-bull">{halving.priceAfter18m ? formatFromUsd(halving.priceAfter18m) : 'En curso'}</td><td className="py-3 text-right font-bold text-bull">{ret == null ? '—' : `+${ret.toLocaleString('es-ES')}%`}</td>
            </tr>;
          })}</tbody>
        </table>
      </AccordionCard>

      <AccordionCard title={`Fase actual: ${data.fase.nombre}`} subtitle="Señales, riesgos y oportunidades">
        <div className="pt-3"><CyclePhaseDetail fase={data.fase} expanded /></div>
      </AccordionCard>
    </div>
  );
}

function AccordionCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="!p-0">
      <details className="group" open>
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span><span className="block text-sm font-bold text-primary sm:text-base">{title}</span><span className="block text-xs text-muted">{subtitle}</span></span>
          <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-white/10 px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
      </details>
    </Card>
  );
}

function HalvingMobileCard({ halving, formatFromUsd }: { halving: MarketData['halvings'][number]; formatFromUsd: (value: number) => string }) {
  const ret = halving.priceAfter18m ? Math.round((halving.priceAfter18m / halving.priceAtHalving - 1) * 100) : null;
  return (
    <div className="liquid-subcard rounded-xl p-3">
      <div className="flex items-center justify-between"><span className="font-bold text-primary">Halving {halving.year}</span><span className="text-xs text-muted">{halving.reward}</span></div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] text-muted">
        <span>Precio<strong className="mt-0.5 block truncate text-xs text-secondary">{formatFromUsd(halving.priceAtHalving)}</strong></span>
        <span>Pico 18m<strong className="mt-0.5 block truncate text-xs text-bull">{halving.priceAfter18m ? formatFromUsd(halving.priceAfter18m) : 'En curso'}</strong></span>
        <span>Retorno<strong className="mt-0.5 block text-xs text-bull">{ret == null ? '—' : `+${ret.toLocaleString('es-ES')}%`}</strong></span>
      </div>
    </div>
  );
}

function Legend() {
  return <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-muted">
    {[['#22c55e', 'Picos'], ['#ef4444', 'Suelos'], ['#f59e0b', 'Actual']].map(([color, label]) => <span key={label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>)}
  </div>;
}

