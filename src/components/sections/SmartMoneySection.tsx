import { useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MarketData } from '@/types';
import { formatUsd } from '@/lib/format';
import { ChartCard, Card } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { SegmentedControl } from '@/components/ui/Controls';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { Building2, Users, Banknote, TrendingDown } from 'lucide-react';

interface SectionProps {
  data: MarketData;
}

type Tab = 'smart' | 'etf';

export function SmartMoneySection({ data }: SectionProps) {
  const [tab, setTab] = useState<Tab>('smart');
  const { etf } = data;
  const signals = deriveSignals(data);

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'smart', label: '🐋 Smart money vs retail' },
            { value: 'etf', label: '🏦 Flujos de ETFs' },
          ]}
        />
      </div>

      {/* Tarjetas de señales: derivadas de la actividad on-chain real (ventana
          de las últimas semanas) cuando los datos están en vivo. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SignalCard
          icon={<Building2 size={18} />}
          color="#22c55e"
          title="Acumulación institucional"
          status={signals.acumulacion.status}
          detail={signals.acumulacion.detail}
        />
        <SignalCard
          icon={<Users size={18} />}
          color="#ef4444"
          title="Pánico retail"
          status={signals.retail.status}
          detail={signals.retail.detail}
        />
        <SignalCard
          icon={<Banknote size={18} />}
          color="#3b82f6"
          title="Flujo de ETFs"
          status={etf.inflowsRecientes >= 0 ? 'Entradas' : 'Salidas'}
          detail={`${etf.inflowsRecientes >= 0 ? '+' : ''}$${etf.inflowsRecientes}B recientes tras la corrección.`}
        />
        <SignalCard
          icon={<TrendingDown size={18} />}
          color="#f59e0b"
          title="Distribución"
          status={signals.distribucion.status}
          detail={signals.distribucion.detail}
        />
      </div>

      {tab === 'smart' ? (
        <>
          <ChartCard
            title="🐋 Smart money vs. 👤 retail"
            subtitle="En cada caída, las ballenas compran mientras el retail vende en pánico"
            info="Eventos históricos (COVID, FTX…) son ilustrativos. La última barra es real: variación on-chain de las últimas semanas (valor grande liquidado vs direcciones activas, fuente Blockchain.com)."
            conclusion="La divergencia se repite: el dinero inteligente acumula precisamente cuando el sentimiento general es más negativo."
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.smartMoney} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                  <XAxis dataKey="event" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[-80, 120]} width={44} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        titleKey="event"
                        renderBody={(d) => (
                          <div className="space-y-0.5 text-sm">
                            <p className="text-bull">🐋 Ballenas: {Number(d.whales) > 0 ? '+' : ''}{String(d.whales)}%</p>
                            <p className="text-bear">👤 Retail: {String(d.retail)}%</p>
                            <p className="text-xs text-muted">Precio: {String(d.priceChange)}%</p>
                          </div>
                        )}
                      />
                    }
                  />
                  <ReferenceLine y={0} stroke="var(--text-muted)" />
                  <Bar dataKey="whales" name="Ballenas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="retail" name="Retail" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="📈 Divergencia on-chain (últimas semanas)"
            subtitle="Valor grande liquidado (proxy ballenas) vs direcciones activas (proxy retail), indexados a 100"
            info="Datos reales de Blockchain.com que se refrescan con la app. 🐋 = valor en USD liquidado on-chain (media móvil 30d); 👤 = direcciones activas (media 14d); precio en miles de $."
            conclusion="Cuando la línea verde (ballenas) y la roja (retail) se separan mientras el precio (naranja) cae, suele reflejar transferencia de monedas de manos débiles a manos fuertes."
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.whaleTimeline} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                  <XAxis dataKey="period" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={[40, 140]} width={36} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        titleKey="period"
                        renderBody={(d) => (
                          <div className="space-y-0.5 text-sm">
                            <p className="text-bull">🐋 Ballenas: {String(d.whaleBalance)}%</p>
                            <p className="text-bear">👤 Retail: {String(d.retailBalance)}%</p>
                            <p className="text-btc">Precio: {formatUsd(Number(d.price) * 1000)}</p>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line type="monotone" dataKey="whaleBalance" name="Ballenas" stroke="#22c55e" strokeWidth={2.5} dot={{ fill: '#22c55e', r: 4 }} />
                  <Line type="monotone" dataKey="retailBalance" name="Retail" stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 4 }} />
                  <Line type="monotone" dataKey="price" name="Precio" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#f59e0b', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <InsightCard rgb="59,130,246" title="💡 Cita clave (Santiment)">
            «Las condiciones óptimas para una ruptura aparecen cuando el smart money acumula y el
            retail vende. Los jugadores institucionales suelen recargar en silencio».
          </InsightCard>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Inflows totales" value={`$${etf.inflowsTotales}B+`} tone="bull" />
            <MetricCard label="AUM total ETFs" value={`$${etf.aumTotal}B`} tone="bull" />
            <MetricCard label="Corrección reciente" value={`$${etf.correccionReciente}B`} tone="bear" />
            <MetricCard label="Inflows recientes" value={`+$${etf.inflowsRecientes}B`} tone="btc" />
          </div>

          <ChartCard
            title="ETFs: acumulación desde el lanzamiento"
            subtitle="Desde enero 2024: tendencia alcista con una corrección reciente"
            info="Flujo acumulado de los ETFs spot de Bitcoin en miles de millones de dólares."
            conclusion="A pesar de la corrección reciente, el balance estructural sigue siendo de fuertes entradas netas desde el lanzamiento."
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={etf.flujos} margin={{ top: 16, right: 16, left: 4, bottom: 40 }}>
                  <defs>
                    <linearGradient id="etfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-45} textAnchor="end" height={52} interval={2} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `$${v}B`} width={44} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        titleKey="month"
                        renderBody={(d) => (
                          <div className="space-y-0.5 text-sm">
                            <p className="text-btc">Acumulado: ${String(d.cumulative)}B</p>
                            <p className={Number(d.monthly) >= 0 ? 'text-bull' : 'text-bear'}>
                              Mes: {Number(d.monthly) >= 0 ? '+' : ''}${String(d.monthly)}B
                            </p>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    fill="url(#etfGrad)"
                    dot={(props) => {
                      const { cx, cy, payload, index } = props;
                      if (payload.correction) return <circle key={index} cx={cx} cy={cy} r={4} fill="#ef4444" />;
                      if (payload.recovery) return <circle key={index} cx={cx} cy={cy} r={5} fill="#22c55e" stroke="#fff" strokeWidth={1.5} />;
                      return <circle key={index} cx={cx} cy={cy} r={2.5} fill="#22c55e" />;
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <InsightCard rgb="34,197,94" title="💡 Idea clave">
            Los ETFs spot abrieron la puerta del capital institucional a Bitcoin. Aunque haya
            semanas de salidas, la base de activos bajo gestión transforma la estructura de demanda
            del activo.
          </InsightCard>
        </>
      )}
    </div>
  );
}

interface SignalState {
  status: string;
  detail: string;
}

/**
 * Deriva el estado de las tarjetas a partir de la divergencia on-chain real
 * (primer vs último punto del timeline). En modo en vivo refleja la realidad;
 * en mock describe el patrón ilustrativo.
 */
function deriveSignals(data: MarketData): {
  acumulacion: SignalState;
  retail: SignalState;
  distribucion: SignalState;
} {
  const tl = data.whaleTimeline;
  const first = tl[0];
  const last = tl[tl.length - 1];
  const whaleChg = first && last ? last.whaleBalance - first.whaleBalance : 0;
  const retailChg = first && last ? last.retailBalance - first.retailBalance : 0;
  const live = data.source === 'live';
  const pct = (v: number) => `${v >= 0 ? '+' : ''}${v}%`;

  const acumulacion: SignalState =
    whaleChg >= 3
      ? { status: 'Activa', detail: 'El valor grande liquidado on-chain crece: manos fuertes activas.' }
      : whaleChg <= -3
        ? { status: 'Débil', detail: 'Menos valor liquidado por grandes tenedores en la ventana.' }
        : { status: 'Neutral', detail: 'Actividad de grandes transferencias estable.' };

  const retail: SignalState =
    retailChg <= -3
      ? { status: 'Elevado', detail: 'Caen las direcciones activas: el retail se retira.' }
      : retailChg >= 3
        ? { status: 'Bajo', detail: 'Suben las direcciones activas: vuelve el minorista.' }
        : { status: 'Moderado', detail: 'Participación minorista sin grandes cambios.' };

  const distribucion: SignalState =
    whaleChg <= -3
      ? { status: 'Alta', detail: 'Señales de salida de manos fuertes.' }
      : whaleChg >= 3
        ? { status: 'Baja', detail: 'Pocas señales de venta masiva de manos fuertes.' }
        : { status: 'Media', detail: 'Sin sesgo claro de acumulación ni distribución.' };

  if (live) {
    acumulacion.detail = `On-chain: ${pct(whaleChg)} en valor grande liquidado (ventana reciente).`;
    retail.detail = `On-chain: ${pct(retailChg)} en direcciones activas (proxy retail).`;
  }

  return { acumulacion, retail, distribucion };
}

function SignalCard({
  icon,
  color,
  title,
  status,
  detail,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  status: string;
  detail: string;
}) {
  return (
    <Card className="!p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-primary">
          <span style={{ color }}>{icon}</span>
          {title}
        </span>
      </div>
      <span
        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
        style={{ background: `${color}1f`, color, border: `1px solid ${color}44` }}
      >
        {status}
      </span>
      <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
    </Card>
  );
}
