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
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { fearGreedZone } from '@/services/marketIndicators';
import { cx, formatGainPct } from '@/lib/format';

interface SectionProps {
  data: MarketData;
}

export function RsiFearSection({ data }: SectionProps) {
  const { indicators } = data;
  // El índice puede faltar: en ese caso no se pinta un 50 de relleno.
  const fearGreed = indicators.fearGreed;
  const fg = fearGreedZone(fearGreed ?? 50);
  // Referencia para el ancho de las barras comparativas. El valor actual entra
  // en vivo y puede superar a todos los mínimos históricos, así que la escala
  // se toma del máximo real de la serie (mínimo 25 para no exagerar valores bajos).
  const fearGreedScale = Math.max(25, ...data.fearGreedHistory.map((e) => e.value));

  return (
    <div className="space-y-3 sm:space-y-4">
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
              <Tooltip content={<ChartTooltip titleKey="event" formatter={(v) => `RSI ${v}`} />} />
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

      {/* Fear & Greed con zonas */}
      <CollapsibleCard
        title="Fear & Greed Index"
        subtitle="Sentimiento agregado del mercado (0 = pánico, 100 = euforia)"
        info="Índice diario de alternative.me. Resume volatilidad, volumen, redes sociales y dominancia en un solo número: 0 es pánico y 100, euforia."
        // La cifra va en la cabecera: es EL dato de la tarjeta y así se lee sin
        // abrirla.
        badge={
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold"
            style={{ color: fg.color, borderColor: `${fg.color}66`, background: `${fg.color}1a` }}
          >
            <span className="font-mono text-sm">{fearGreed ?? '—'}</span>
            {indicators.fearGreedLabel ?? 'Sin dato'}
          </span>
        }
      >
        {fearGreed == null ? (
          <p className="py-6 text-center text-sm text-muted">
            El índice de miedo y codicia no está disponible ahora mismo.
          </p>
        ) : (
          <FearGreedGauge value={fearGreed} />
        )}

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-secondary sm:text-sm">
            Comparativa con mínimos históricos
          </p>
          <div className="space-y-1.5">
            {data.fearGreedHistory.map((e) => (
              <div key={e.event} className="flex items-center gap-2 sm:gap-3">
                <span className="w-20 shrink-0 text-[11px] text-muted sm:w-28 sm:text-xs">{e.event}</span>
                <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-white/5 sm:h-5">
                  <div
                    className={cx('flex h-full min-w-0 items-center justify-end overflow-hidden rounded-full pr-2 text-[10px] font-bold text-white transition-all', e.highlight && 'animate-pulse')}
                    style={{
                      // La escala se calcula sobre el máximo REAL de la serie, no
                      // sobre un 25 fijo: el valor actual llega en vivo y puede
                      // superarlo, y entonces la barra se salía del contenedor.
                      width: `${Math.min(100, (e.value / fearGreedScale) * 100)}%`,
                      background: e.highlight ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {e.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}

// Barra de zonas de sentimiento con marcador del valor actual.
function FearGreedGauge({ value }: { value: number }) {
  const zones = [
    { label: 'Miedo extremo', color: '#b91c1c', range: '0-20' },
    { label: 'Miedo', color: '#ef4444', range: '20-40' },
    { label: 'Neutral', color: '#94a3b8', range: '40-60' },
    { label: 'Codicia', color: '#22c55e', range: '60-80' },
    { label: 'Codicia extrema', color: '#16a34a', range: '80-100' },
  ];
  return (
    <div>
      <div className="relative h-7 overflow-hidden rounded-full">
        <div className="flex h-full">
          {zones.map((z) => (
            <div key={z.label} className="h-full flex-1" style={{ background: z.color }} />
          ))}
        </div>
        {/* Marcador */}
        <div
          className="absolute top-0 h-full w-1 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          style={{ left: `${value}%` }}
        />
        <div
          className="absolute -top-1 -translate-x-1/2"
          style={{ left: `${value}%` }}
        >
          <div className="h-3 w-3 rotate-45 border-2 border-white bg-[var(--bg-base)]" />
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        {zones.map((z) => (
          <span key={z.label} className="flex-1 text-center">{z.label}</span>
        ))}
      </div>
    </div>
  );
}
