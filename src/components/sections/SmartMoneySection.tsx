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
    <ChartCard
      title="Divergencia on-chain"
      subtitle="Valor grande liquidado (ballenas) frente a direcciones activas (retail), indexados a 100"
      info="Series de Blockchain.com que se refrescan con la app. 🐋 = valor liquidado on-chain (media móvil de 30 días); 👤 = direcciones activas (media de 14 días); el precio va en la moneda global. Cuando las dos líneas se separan mientras el precio cae, suele reflejar monedas pasando de manos débiles a manos fuertes."
    >
      {/* Señales derivadas de la actividad on-chain real de las últimas semanas. */}
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        <SignalCard
          icon={<Building2 size={16} />}
          color="#22c55e"
          title="Acumulación institucional"
          status={signals.acumulacion.status}
          detail={signals.acumulacion.detail}
        />
        <SignalCard
          icon={<Users size={16} />}
          color="#ef4444"
          title="Pánico retail"
          status={signals.retail.status}
          detail={signals.retail.detail}
        />
        <SignalCard
          icon={<TrendingDown size={16} />}
          color="#f59e0b"
          title="Distribución"
          status={signals.distribucion.status}
          detail={signals.distribucion.detail}
        />
      </div>

      <div className="mt-4 h-64">
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
    <div className="liquid-subcard rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-primary">
          <span className="shrink-0" style={{ color }}>{icon}</span>
          <span className="truncate">{title}</span>
        </span>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: `${color}1f`, color, border: `1px solid ${color}44` }}
        >
          {status}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">{detail}</p>
    </div>
  );
}
