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
  const expansion = macro.ismActual >= 50;

  return (
    <div className="space-y-6">
      <ChartCard
        title="ISM Manufacturing: el ciclo económico"
        subtitle="Por encima de 50 = expansión · por debajo = contracción · índice de referencia"
        info="El ISM PMI mide la actividad manufacturera de EE. UU. (termómetro adelantado del ciclo). No está disponible gratis en FRED por licencia, así que aquí se muestra como serie de referencia; el tablero macro de abajo sí usa datos reales de FRED."
        conclusion={
          expansion
            ? 'El ISM ha vuelto a cruzar 50 al alza tras una larga contracción. Históricamente, salir de contracción con Bitcoin sobrevendido ha sido un contexto favorable para el riesgo.'
            : 'El ISM sigue por debajo de 50: la economía aún está en contracción. Conviene vigilar el giro al alza como posible catalizador.'
        }
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={macro.ism} margin={{ top: 16, right: 16, left: 4, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="period" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-45} textAnchor="end" height={52} interval={1} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={[44, 66]} width={32} />
              <Tooltip content={<ChartTooltip titleKey="period" formatter={(v) => `ISM ${v}`} />} />
              <ReferenceLine y={50} stroke="#f59e0b" strokeWidth={2} label={{ value: '50 · expansión/contracción', fill: '#f59e0b', fontSize: 11, position: 'insideBottomRight' }} />
              <Line
                type="monotone"
                dataKey="value"
                name="ISM PMI"
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

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Pico de ciclo (2021)" value="64.7" tone="bull" />
          <MetricCard label="Mínimo de contracción" value="46.4" tone="bear" />
          <MetricCard label="Meses bajo 50" value="~26" tone="btc" />
          <MetricCard
            label="Ahora"
            value={String(macro.ismActual)}
            sub={expansion ? 'Expansión' : 'Contracción'}
            tone={expansion ? 'bull' : 'bear'}
          />
        </div>
      </ChartCard>

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-btc">Tablero macro</h3>
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
        </div>
        <p className="mb-4 text-sm text-muted">
          Factores que condicionan el apetito por el riesgo y, con él, a Bitcoin.
        </p>
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
      </Card>

      <InsightCard rgb="16,185,129" title="💡 Por qué importa el macro">
        Bitcoin no vive aislado: la liquidez global, los tipos de interés y el dólar marcan el
        apetito por el riesgo. Cuando el ciclo económico mejora y coincide con miedo extremo en el
        precio, el contexto histórico ha sido especialmente interesante.
      </InsightCard>
    </div>
  );
}
