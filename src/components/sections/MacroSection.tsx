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
import { ArrowDown, ArrowUp, Droplets, Factory, Gauge, Landmark, Minus, type LucideIcon } from 'lucide-react';
import type { MacroIndicator, MarketData } from '@/types';
import type { MacroGroup } from '@/types/macro';
import { ChartCard, Card } from '@/components/ui/Card';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { MetricCard } from '@/components/ui/MetricCard';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { Sparkline } from '@/components/charts/Sparkline';
import { cx, formatNumberEs } from '@/lib/format';
import { dec } from '@/lib/numberEs';

// =============================================================================
// Análisis → ENTORNO MACRO.
//
// Trece indicadores de FRED agrupados por lo que explican: liquidez, política
// monetaria, crecimiento y condiciones financieras. Cada uno enseña su último
// dato publicado con su fecha REAL, el anterior, la variación, la tendencia de
// fondo y cada cuánto se publica: un dato mensual se presenta como mensual,
// aunque se haya consultado hace un minuto.
//
// La lectura (punto de color) dice si ese dato, ahora, favorece o perjudica a
// los activos de riesgo. Por qué está cada indicador y cómo se interpreta vive
// en Ajustes → Información; aquí solo la definición corta del icono «i».
// =============================================================================

const GRUPOS: { id: MacroGroup; titulo: string; icon: LucideIcon }[] = [
  { id: 'liquidez', titulo: 'Liquidez', icon: Droplets },
  { id: 'politica', titulo: 'Política monetaria y tipos', icon: Landmark },
  { id: 'crecimiento', titulo: 'Crecimiento y actividad', icon: Factory },
  { id: 'condiciones', titulo: 'Condiciones financieras y riesgo', icon: Gauge },
];

const FRECUENCIA: Record<MacroIndicator['frecuencia'], string> = {
  diaria: 'Diario',
  semanal: 'Semanal',
  mensual: 'Mensual',
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Fecha del dato tal como se entiende. Un dato mensual de FRED lleva fecha del
 * día 1 («2026-08-01»), que leído como «1 ago» parecería la fecha de
 * publicación: se escribe como el mes al que corresponde.
 */
function fechaDato(fecha: string, frecuencia: MacroIndicator['frecuencia']): string {
  const [y, m, d] = fecha.split('-');
  if (frecuencia === 'mensual') return `${MESES[Number(m) - 1]} ${y}`;
  return `${Number(d)} ${MESES[Number(m) - 1]} ${y!.slice(2)}`;
}

/** Fecha corta del dato anterior: el mes, o el día y el mes. */
function fechaCorta(fecha: string, frecuencia: MacroIndicator['frecuencia']): string {
  const [y, m, d] = fecha.split('-');
  return frecuencia === 'mensual' ? `${MESES[Number(m) - 1]} ${y!.slice(2)}` : `${Number(d)} ${MESES[Number(m) - 1]}`;
}

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
    <div className="space-y-3 sm:space-y-4">
      <MacroBoard macro={macro} frescura={data.frescura.macro} />

      {chart && (
      <ChartCard
        title="El ciclo de liquidez (M2)"
        subtitle={`${chart.unit} · dato mensual de la Reserva Federal (FRED), hasta ${chart.points[chart.points.length - 1]?.period ?? '—'}`}
        info="Variación interanual de la masa monetaria M2 de EE. UU. Cuando la liquidez se expande, los activos de riesgo suelen encontrar mejor terreno; cuando se contrae, ocurre lo contrario. Describe el entorno, no predice el precio."
      >
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart.points} margin={{ top: 16, right: 16, left: 4, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="period" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-45} textAnchor="end" height={52} interval={1} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={38} tickFormatter={(v) => `${formatNumberEs(v, 1)}%`} />
              <Tooltip content={<ChartTooltip titleKey="period" formatter={(v) => `${formatNumberEs(v, 2)}%`} />} />
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
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <MetricCard
            label="Máximo del periodo"
            value={`${dec(Math.max(...chart.points.map((p) => p.value)), 1)}%`}
            tone="bull"
          />
          <MetricCard
            label="Mínimo del periodo"
            value={`${dec(Math.min(...chart.points.map((p) => p.value)), 1)}%`}
            tone="bear"
          />
          <MetricCard
            label="Meses en contracción"
            value={String(chart.points.filter((p) => p.value < chart.reference).length)}
            sub={`de ${chart.points.length}`}
            tone="btc"
          />
        </div>
      </ChartCard>
      )}
    </div>
  );
}

// --- Tablero -----------------------------------------------------------------

function MacroBoard({ macro, frescura }: { macro: MarketData['macro']; frescura: MarketData['frescura']['macro'] }) {
  const favor = macro.indicadores.filter((i) => i.estado === 'positivo').length;
  const contra = macro.indicadores.filter((i) => i.estado === 'negativo').length;

  return (
    <CollapsibleCard
      title="Entorno macro"
      subtitle="Liquidez, tipos, crecimiento y condiciones financieras"
      badge={
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-semibold">
            <span className="text-bull">{favor} a favor</span>
            <span className="text-muted"> · </span>
            <span className="text-bear">{contra} en contra</span>
          </span>
          <FreshnessTag
            freshness={frescura?.reserva ? 'cache' : 'actualizado'}
            at={macro.actualizado}
            source="FRED · Reserva Federal de San Luis"
          />
        </span>
      }
    >
      <div className="space-y-4">
        {GRUPOS.map((g) => {
          const items = macro.indicadores.filter((i) => i.grupo === g.id);
          if (items.length === 0) return null;
          const Icon = g.icon;
          return (
            <section key={g.id} aria-label={g.titulo}>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                <Icon size={14} aria-hidden="true" className="text-btc" />
                {g.titulo}
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                {items.map((ind) => (
                  <MacroTile key={ind.id} ind={ind} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {macro.faltan.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Sin dato ahora mismo: {macro.faltan.map((f) => f.nombre).join(', ')}. Se vuelve a pedir
          sola; no se enseña una cifra de relleno mientras tanto.
        </p>
      )}
    </CollapsibleCard>
  );
}

function MacroTile({ ind }: { ind: MacroIndicator }) {
  const color = ESTADO_COLOR[ind.estado];
  const Arrow = ind.cambioSigno > 0 ? ArrowUp : ind.cambioSigno < 0 ? ArrowDown : Minus;
  const lectura =
    ind.estado === 'positivo' ? 'favorable' : ind.estado === 'negativo' ? 'desfavorable' : 'neutral';

  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-2.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold leading-tight text-secondary">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: color }}
          title={`Lectura ${lectura} para el riesgo`}
        />
        <span className="min-w-0 break-words">{ind.nombre}</span>
        <InfoTooltip text={`${ind.descripcion} ${ind.cadencia}. Unidad: ${ind.unidad}.`} />
      </span>

      <div className="mt-1.5 flex items-end justify-between gap-1.5">
        <span className="min-w-0 font-mono text-[clamp(0.85rem,3.6vw,1.15rem)] font-bold leading-none text-primary">
          {ind.valor}
          {ind.valorUnidad && (
            <span className="ml-1 font-sans text-[10px] font-semibold text-muted">{ind.valorUnidad}</span>
          )}
        </span>
        <Sparkline
          values={ind.spark}
          color={color}
          className="h-[18px] w-16 shrink-0"
          label={`Tendencia: ${ind.tendencia ?? 'sin datos'}`}
        />
      </div>

      {/* Variación y dato anterior en una sola línea: «▲ +0,21 pp · antes
          4,41% (jul 26)». La etiqueta completa de la comparación va en el
          título accesible para no alargar la ficha. */}
      {ind.cambio && (
        <p
          className="mt-1.5 flex flex-wrap items-center gap-x-1 text-[10px] leading-tight text-secondary"
          title={`${ind.cambio} ${ind.cambioLabel}`}
        >
          <Arrow size={11} aria-hidden="true" className="shrink-0" />
          <span className="font-mono font-semibold">{ind.cambio}</span>
          {ind.anterior && (
            <span className="text-muted">
              · antes {ind.anterior}
              {ind.anteriorFecha && ` (${fechaCorta(ind.anteriorFecha, ind.frecuencia)})`}
            </span>
          )}
        </p>
      )}
      <p className={cx('mt-1 text-[10px] leading-tight text-muted')}>
        {FRECUENCIA[ind.frecuencia]} · {fechaDato(ind.fecha, ind.frecuencia)}
      </p>
    </div>
  );
}
