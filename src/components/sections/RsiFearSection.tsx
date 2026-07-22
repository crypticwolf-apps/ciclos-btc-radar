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
import { ChartCard, Card } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { fearGreedZone } from '@/services/marketIndicators';
import { cx } from '@/lib/format';

interface SectionProps {
  data: MarketData;
}

export function RsiFearSection({ data }: SectionProps) {
  const { indicators } = data;
  const fg = fearGreedZone(indicators.fearGreed);

  return (
    <div className="space-y-6">
      <ChartCard
        title="RSI en sobreventa histórica"
        subtitle="Pocas veces en la historia el RSI ha caído por debajo de 30"
        info="El RSI (Índice de Fuerza Relativa) mide el momentum. Por debajo de 30 indica sobreventa; por encima de 70, sobrecompra."
        conclusion="El RSI bajo no es una garantía de suelo, pero históricamente las lecturas extremas de sobreventa han coincidido con zonas de acumulación interesantes."
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.rsiBottoms} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="event" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={[0, 40]} width={32} />
              <Tooltip content={<ChartTooltip titleKey="event" formatter={(v) => `RSI ${v}`} />} />
              <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Sobreventa <30', fill: '#ef4444', fontSize: 11, position: 'insideTopRight' }} />
              <Bar dataKey="rsi" name="RSI (14d)" radius={[4, 4, 0, 0]}>
                {data.rsiBottoms.map((e, i) => (
                  <Cell key={i} fill={e.current ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-5">
          <h4 className="mb-3 text-sm font-semibold text-secondary">
            Retorno 12 meses después de señales RSI &lt;30 (histórico, no predicción)
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['+225%', '2015', false],
              ['+150%', '2018', false],
              ['+1.060%', 'COVID 2020', false],
              ['???', 'Actual', true],
            ].map(([v, l, current]) => (
              <div
                key={l as string}
                className="rounded-xl border p-4 text-center"
                style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)' }}
              >
                <p className={cx('font-mono text-2xl font-bold', current ? 'animate-pulse text-btc' : 'text-bull')}>
                  {v as string}
                </p>
                <p className="mt-0.5 text-xs text-muted">{l as string}</p>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>

      {/* Fear & Greed con zonas */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-btc">Fear &amp; Greed Index</h3>
            <p className="text-sm text-muted">Sentimiento agregado del mercado (0 = pánico, 100 = euforia)</p>
          </div>
          <div className="text-right">
            <span className="font-mono text-3xl font-bold" style={{ color: fg.color }}>
              {indicators.fearGreed}
            </span>
            <p className="text-sm font-semibold" style={{ color: fg.color }}>
              {indicators.fearGreedLabel}
            </p>
          </div>
        </div>

        <FearGreedGauge value={indicators.fearGreed} />

        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-secondary">Comparativa con mínimos históricos</p>
          <div className="space-y-2">
            {data.fearGreedHistory.map((e) => (
              <div key={e.event} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted">{e.event}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cx('flex h-full items-center justify-end rounded-full pr-2 text-[10px] font-bold text-white transition-all', e.highlight && 'animate-pulse')}
                    style={{ width: `${(e.value / 25) * 100}%`, background: e.highlight ? '#f59e0b' : '#ef4444' }}
                  >
                    {e.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-sm font-medium text-btc">
            El miedo actual es comparable —o inferior— al de Mt. Gox, el COVID o FTX.
          </p>
        </div>
      </Card>

      <InsightCard rgb="245,158,11" title="💡 Idea clave">
        El miedo extremo no marca el suelo exacto, pero históricamente ha estado mucho más cerca de
        los suelos que de los techos. «Sé codicioso cuando otros tienen miedo» — con gestión de
        riesgo y sin apalancamiento ciego.
      </InsightCard>
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
