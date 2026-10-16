import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MarketData } from '@/types';
import { ChartCard } from '@/components/ui/Card';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { MiedoCodiciaCard } from './MiedoCodiciaCard';
import { cx, formatGainPct, formatNumberEs } from '@/lib/format';

interface SectionProps {
  data: MarketData;
  /** Solo una de sus dos tarjetas, para repartirlas en columnas en escritorio. */
  parte?: 'rsi' | 'miedo';
}

export function RsiFearSection({ data, parte }: SectionProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {parte !== 'miedo' && (
      <ChartCard
        title="RSI en sobreventa histórica"
        subtitle="Pocas veces en la historia el RSI ha caído por debajo de 30"
        info="El RSI (Índice de Fuerza Relativa) mide el momentum. Por debajo de 30 indica sobreventa; por encima de 70, sobrecompra. Una lectura extrema no marca el suelo: solo dice que la caída ha sido rápida."
      >
        {data.rsiBottoms.length === 0 ? (
          <p className="text-sm text-muted">
            No hay suelos de RSI que mostrar: la serie diaria de precios no ha llegado.
          </p>
        ) : (
          <>
        <div className="h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.rsiBottoms} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="event" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={[0, 40]} width={32} />
              <Tooltip content={<ChartTooltip titleKey="event" formatter={(v) => formatNumberEs(v, 1)} />} />
              <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Sobreventa', fill: '#ef4444', fontSize: 11, position: 'insideTopLeft' }} />
              <Bar dataKey="rsi" name="RSI (14d)" radius={[4, 4, 0, 0]}>
                {data.rsiBottoms.map((e, i) => (
                  <Cell key={i} fill={e.current ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold text-secondary sm:text-sm">
            Retorno 12 meses después de cada señal (histórico, no predicción)
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {/* Uno por cada suelo real de la serie, con su rendimiento medido, y
                en ROJO cuando el año siguiente fue a peor: pintarlos todos de
                verde daba por bueno un resultado que podía ser negativo. */}
            {data.rsiBottoms.map((b) => {
              const negativo = b.return1Y != null && b.return1Y < 0;
              return (
                <div
                  key={b.event}
                  className={cx(
                    'rounded-xl border p-3 text-center',
                    b.return1Y == null
                      ? 'border-white/10 bg-white/5'
                      : negativo
                        ? 'border-bear/25 bg-bear/10'
                        : 'border-bull/25 bg-bull/10',
                  )}
                >
                  <p
                    className={cx(
                      'font-mono text-lg font-bold sm:text-xl',
                      b.return1Y == null ? 'text-muted' : negativo ? 'text-bear' : 'text-bull',
                    )}
                  >
                    {b.return1Y == null ? '—' : formatGainPct(b.return1Y)}
                  </p>
                  <p className="mt-0.5 text-[11px] capitalize leading-tight text-muted">{b.event}</p>
                  {b.return1Y == null && (
                    <p className="mt-0.5 text-[10px] leading-tight text-muted">aún sin cerrar el año</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
          </>
        )}
      </ChartCard>
      )}

      {/* Fear & Greed con zonas */}
      {parte !== 'rsi' && (
      <>
      <MiedoCodiciaCard data={data} />
      </>
      )}
    </div>
  );
}
