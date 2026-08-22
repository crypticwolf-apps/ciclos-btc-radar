import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MarketData } from '@/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChartCard, Card } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { Building2, Users, TrendingDown } from 'lucide-react';

interface SectionProps {
  data: MarketData;
}

export function SmartMoneySection({ data }: SectionProps) {
  const signals = deriveSignals(data);
  const { formatFromUsd } = useCurrency();

  if (data.whaleTimeline.length === 0) {
    return (
      <Card>
        <h3 className="text-base font-bold text-primary">Divergencia on-chain no disponible</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-secondary">
          Ningún proveedor de series on-chain ha respondido. La sección vuelve sola en cuanto lo
          haga; no se muestra una divergencia de ejemplo mientras tanto.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      {/* Tarjetas de señales: derivadas de la actividad on-chain real (ventana
          de las últimas semanas) cuando los datos están en vivo. */}
      <div className="grid gap-4 sm:grid-cols-3">
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
          icon={<TrendingDown size={18} />}
          color="#f59e0b"
          title="Distribución"
          status={signals.distribucion.status}
          detail={signals.distribucion.detail}
        />
      </div>

          <ChartCard
            title="📈 Divergencia on-chain (últimas semanas)"
            subtitle="Valor grande liquidado (proxy ballenas) vs direcciones activas (proxy retail), indexados a 100"
            info="Datos reales de Blockchain.com que se refrescan con la app. 🐋 = valor liquidado on-chain (media móvil 30d); 👤 = direcciones activas (media 14d); el precio sigue la moneda global."
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
                            <p className="text-btc">Precio: {formatFromUsd(Number(d.price) * 1000)}</p>
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
    </div>
  );
}

interface SignalState {
  status: string;
  detail: string;
}

/**
 * Deriva el estado de las tarjetas a partir de la divergencia on-chain real
 * (primer vs último punto del timeline).
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
