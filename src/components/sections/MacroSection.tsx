import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Droplets,
  Percent,
  DollarSign,
  TrendingUp,
  Gauge,
  type LucideIcon,
} from 'lucide-react';
import type { MacroIndicator, MarketData } from '@/types';
import { ChartCard, Card } from '@/components/ui/Card';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { InsightCard } from '@/components/ui/InsightCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { cx } from '@/lib/format';

const ICONS: Record<string, LucideIcon> = {
  Droplets,
  Percent,
  DollarSign,
  TrendingUp,
  Gauge,
};

const ESTADO_COLOR: Record<MacroIndicator['estado'], string> = {
  positivo: '#22c55e',
  negativo: '#ef4444',
  neutral: '#94a3b8',
};

interface SectionProps {
  data: MarketData;
}

export function MacroSection({ data }: SectionProps) {
  const { macro } = data;
  const chart = macro.chart;
  const last = chart?.points[chart.points.length - 1]?.value ?? null;
  const expansion = last != null && last > chart!.reference;

  if (!chart && macro.indicadores.length === 0) {
    return (
      <Card>
        <h3 className="text-base font-bold text-primary">Tablero macro no disponible</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-secondary">
          Las series de la Reserva Federal (FRED) no están accesibles ahora mismo. No se muestra un
          tablero de ejemplo: vuelve solo en cuanto respondan.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {chart && (
      <ChartCard
        title={`${chart.label}: el ciclo de liquidez`}
        subtitle={`${chart.unit} · dato mensual de la Reserva Federal (FRED)`}
        info="Variación interanual de la masa monetaria M2 de EE. UU. Cuando la liquidez se expande, los activos de riesgo suelen encontrar mejor terreno; cuando se contrae, ocurre lo contrario. Describe el entorno, no predice el precio."
        conclusion={
          expansion
            ? 'La liquidez vuelve a crecer respecto al año pasado: entorno monetario más favorable para los activos de riesgo.'
            : 'La liquidez sigue por debajo de donde estaba hace un año: entorno monetario restrictivo.'
        }
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart.points} margin={{ top: 16, right: 16, left: 4, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="period" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-45} textAnchor="end" height={52} interval={1} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={38} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<ChartTooltip titleKey="period" formatter={(v) => `${v}%`} />} />
              <ReferenceLine y={chart.reference} stroke="#f59e0b" strokeWidth={2} label={{ value: chart.referenceLabel, fill: '#f59e0b', fontSize: 11, position: 'insideBottomRight' }} />
              <Line
                type="monotone"
                dataKey="value"
                name={chart.label}
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx: x, cy, payload, index } = props;
                  if (payload.current) return <circle key={index} cx={x} cy={cy} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} className="animate-pulse" />;
                  return <circle key={index} cx={x} cy={cy} r={2.5} fill="#22c55e" />;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Extremos REALES de la propia serie, no cifras de referencia. */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Máximo del periodo"
            value={`${Math.max(...chart.points.map((p) => p.value)).toFixed(1)}%`}
            tone="bull"
          />
          <MetricCard
            label="Mínimo del periodo"
            value={`${Math.min(...chart.points.map((p) => p.value)).toFixed(1)}%`}
            tone="bear"
          />
          <MetricCard
            label="Meses en contracción"
            value={String(chart.points.filter((p) => p.value < chart.reference).length)}
            sub={`de ${chart.points.length}`}
            tone="btc"
          />
          <MetricCard
            label="Ahora"
            value={last == null ? '—' : `${last.toFixed(1)}%`}
            sub={expansion ? 'Expansión' : 'Contracción'}
            tone={expansion ? 'bull' : 'bear'}
          />
        </div>
      </ChartCard>
      )}

      <CollapsibleCard
        title="Tablero macro"
        subtitle="Factores que condicionan el apetito por el riesgo y, con él, a Bitcoin."
        badge={
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
              macro.indicadoresLive
                ? 'border-bull/40 bg-bull/10 text-bull'
                : 'border-btc/40 bg-btc/10 text-btc',
            )}
            title={
              macro.indicadoresLive
                ? 'Datos macro reales de FRED (Reserva Federal de St. Louis).'
                : 'Datos de referencia. Configura el proxy de FRED y FRED_API_KEY para datos en vivo.'
            }
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', macro.indicadoresLive ? 'bg-bull' : 'bg-btc')} />
            {macro.indicadoresLive ? 'FRED · en vivo' : 'Referencia'}
          </span>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {macro.indicadores.map((ind) => {
            const Icon = ICONS[ind.icono] ?? Gauge;
            const color = ESTADO_COLOR[ind.estado];
            return (
              <div key={ind.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <span style={{ color }}>
                      <Icon size={18} />
                    </span>
                    {ind.nombre}
                  </span>
                  <span
                    className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold')}
                    style={{ background: `${color}1f`, color, border: `1px solid ${color}44` }}
                  >
                    {ind.valor}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted">{ind.descripcion}</p>
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      <InsightCard rgb="16,185,129" title="💡 Por qué importa el macro">
        Bitcoin no vive aislado: la liquidez global, los tipos de interés y el dólar marcan el
        apetito por el riesgo. Cuando el ciclo económico mejora y coincide con miedo extremo en el
        precio, el contexto histórico ha sido especialmente interesante.
      </InsightCard>
    </div>
  );
}
