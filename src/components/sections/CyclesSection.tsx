import { useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown } from 'lucide-react';
import type { MarketData } from '@/types';
import { formatDateEs, formatGainPct, formatGrowth } from '@/lib/format';
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

      <AccordionCard
        title="Histórico de halvings"
        subtitle="Suelo, halving, techo y revalorización de cada ciclo"
      >
        <div className="grid gap-2 pt-3 lg:hidden">
          {data.halvings.map((halving) => <HalvingMobileCard key={halving.year} halving={halving} formatFromUsd={formatFromUsd} />)}
        </div>
        <table className="mt-3 hidden w-full table-fixed text-sm lg:table">
          <caption className="sr-only">
            Suelo, precio en el halving, techo y revalorización de cada ciclo de Bitcoin
          </caption>
          <thead><tr className="border-b border-white/10 text-left text-xs text-muted">
            <th scope="col" className="w-[16%] py-2">Ciclo</th>
            <th scope="col" className="w-[21%] py-2 text-right">Suelo del ciclo</th>
            <th scope="col" className="w-[21%] py-2 text-right">En el halving</th>
            <th scope="col" className="w-[21%] py-2 text-right">Techo del ciclo</th>
            <th scope="col" className="w-[21%] py-2 text-right">Suelo → techo</th>
          </tr></thead>
          <tbody>{data.halvings.map((halving) => (
            <tr key={halving.year} className="border-b border-white/5 align-top">
              <th scope="row" className="py-3 text-left font-medium text-primary">
                {halving.year}
                <span className="block text-[10px] font-normal text-muted">{halving.reward}</span>
              </th>
              <td className="py-3 text-right font-mono text-bear">
                {halving.sueloCiclo == null ? '—' : formatFromUsd(halving.sueloCiclo)}
                {halving.sueloFecha && (
                  <span className="block font-sans text-[10px] text-muted">{formatDateEs(halving.sueloFecha)}</span>
                )}
              </td>
              <td className="py-3 text-right font-mono text-secondary">
                {formatFromUsd(halving.priceAtHalving)}
                <span className="block font-sans text-[10px] text-muted">{formatDateEs(halving.fecha)}</span>
              </td>
              <td className="py-3 text-right font-mono text-bull">
                {halving.picoCiclo == null ? 'En curso' : formatFromUsd(halving.picoCiclo)}
                {halving.picoFecha && (
                  <span className="block font-sans text-[10px] text-muted">{formatDateEs(halving.picoFecha)}</span>
                )}
              </td>
              <td className="py-3 text-right font-mono font-bold text-bull">
                {halving.sueloAPicoPct == null ? '—' : formatGainPct(halving.sueloAPicoPct)}
                {halving.cicloAbierto && (
                  <span className="block font-sans text-[10px] font-normal text-muted">ciclo abierto</span>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          <strong className="text-secondary">Suelo del ciclo</strong>: mínimo del mercado bajista
          previo al halving. <strong className="text-secondary">Techo del ciclo</strong>: máximo en
          los 18 meses posteriores. Ambos son cierres diarios reales (Coin Metrics), no
          estimaciones. Cada ciclo ha rendido menos que el anterior: el patrón se ha repetido
          cuatro veces, lo que no garantiza que vuelva a hacerlo. Los importes en euros usan el
          cambio actual, no el de la fecha histórica.
        </p>
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
  return (
    <div className="liquid-subcard rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-primary">Ciclo {halving.year}</span>
        <span className="shrink-0 text-xs text-muted">{halving.reward}</span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <Celda etiqueta="Suelo" valor={halving.sueloCiclo == null ? '—' : formatFromUsd(halving.sueloCiclo)} fecha={halving.sueloFecha} tono="text-bear" />
        <Celda etiqueta="Halving" valor={formatFromUsd(halving.priceAtHalving)} fecha={halving.fecha} tono="text-secondary" />
        <Celda etiqueta="Techo" valor={halving.picoCiclo == null ? 'En curso' : formatFromUsd(halving.picoCiclo)} fecha={halving.picoFecha} tono="text-bull" />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-bull/10 px-2.5 py-1.5">
        <span className="text-[10px] text-muted">Del suelo al techo</span>
        <span className="font-mono text-sm font-bold text-bull">
          {halving.sueloAPicoPct == null ? '—' : formatGainPct(halving.sueloAPicoPct)}
          {halving.cicloAbierto && <span className="ml-1 font-sans text-[10px] font-normal text-muted">(abierto)</span>}
        </span>
      </div>
    </div>
  );
}

function Celda({ etiqueta, valor, fecha, tono }: { etiqueta: string; valor: string; fecha: string | null; tono: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[10px] text-muted">{etiqueta}</span>
      <strong className={`mt-0.5 block truncate font-mono text-xs ${tono}`}>{valor}</strong>
      {fecha && <span className="mt-0.5 block truncate text-[9px] text-muted">{formatDateEs(fecha)}</span>}
    </span>
  );
}

function Legend() {
  return <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-muted">
    {[['#22c55e', 'Picos'], ['#ef4444', 'Suelos'], ['#f59e0b', 'Actual']].map(([color, label]) => <span key={label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>)}
  </div>;
}

