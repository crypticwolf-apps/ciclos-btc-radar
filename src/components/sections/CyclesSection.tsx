import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MarketData } from '@/types';
import { cx, formatDateEs, formatGainPct } from '@/lib/format';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChartCard } from '@/components/ui/Card';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { CyclePhaseBadge } from '@/components/ui/CyclePhaseBadge';
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
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} scale={log ? 'log' : 'linear'} domain={log ? [0.1, (max: number) => max * 1.6] : [0, (max: number) => Math.ceil(max * 1.1)]} tickFormatter={(value) => formatCompactFromUsd(Number(value), { maximumFractionDigits: 0 })} width={66} />
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

      {/* «Comparación de rendimiento por ciclo» ya no está: repetía el
          suelo → techo de cada ciclo que esta misma tabla da con más detalle,
          y lo hacía con otro método (zigzag sobre la serie), así que el mismo
          ciclo podía salir con dos cifras distintas en la misma pantalla. */}
      <CollapsibleCard
        titleClassName="text-primary"
        title="Histórico de halvings"
        subtitle="Suelo, halving, techo y revalorización de cada ciclo, incluido el actual"
      >
        <div className="grid gap-2 lg:hidden">
          {data.halvings.map((halving) => (
            <HalvingMobileCard key={halving.year} halving={halving} fila={fila(halving, data.bitcoin.precio, formatFromUsd)} />
          ))}
        </div>
        <table className="mt-3 hidden w-full table-fixed text-sm lg:table">
          <caption className="sr-only">
            Suelo, precio en el halving, techo y revalorización de cada ciclo de Bitcoin, incluido el ciclo en curso
          </caption>
          <thead><tr className="border-b border-white/10 text-left text-xs text-muted">
            <th scope="col" className="w-[16%] py-2">Ciclo</th>
            <th scope="col" className="w-[21%] py-2 text-right">Suelo del ciclo</th>
            <th scope="col" className="w-[21%] py-2 text-right">En el halving</th>
            <th scope="col" className="w-[21%] py-2 text-right">Techo del ciclo</th>
            <th scope="col" className="w-[21%] py-2 text-right">Suelo → techo</th>
          </tr></thead>
          <tbody>{data.halvings.map((halving) => {
            const f = fila(halving, data.bitcoin.precio, formatFromUsd);
            return (
              <tr
                key={halving.year}
                className={cx('border-b border-white/5 align-top', halving.actual && 'bg-btc/5')}
              >
                <th scope="row" className="py-3 pl-2 text-left font-medium text-primary">
                  {halving.year}
                  {halving.actual && <EnCurso />}
                  <span className="block text-[10px] font-normal text-muted">{halving.reward}</span>
                </th>
                <CeldaTabla c={f.suelo} tono="text-bear" />
                <CeldaTabla c={f.halving} tono="text-secondary" />
                <CeldaTabla c={f.techo} tono="text-bull" />
                <CeldaTabla c={f.revalorizacion} tono="text-bull" bold />
              </tr>
            );
          })}</tbody>
        </table>
      </CollapsibleCard>

      <CollapsibleCard
        titleClassName="text-primary"
        title="Fase actual"
        subtitle="Señales, oportunidades y riesgos de esta fase"
        badge={<CyclePhaseBadge fase={data.fase} />}
      >
        <CyclePhaseDetail fase={data.fase} />
      </CollapsibleCard>
    </div>
  );
}


// --- Histórico de halvings ---------------------------------------------------

interface CeldaDato {
  valor: string;
  /** Línea pequeña bajo el valor: fecha o aclaración. */
  nota: string | null;
  /** Valor que todavía no existe: se pinta apagado. */
  pendiente?: boolean;
}

type Halving = MarketData['halvings'][number];

/** Mes y año, para una fecha que es una estimación («≈ abr 2028»). */
function mesAprox(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(new Date(iso));
}

/**
 * Las cuatro celdas de un ciclo. El ciclo en curso enseña solo lo que ya se
 * sabe: su suelo hasta hoy (provisional, aún puede bajar) y la fecha estimada
 * del próximo halving. Lo que no ha ocurrido —precio del halving, techo y su
 * fecha— queda «por determinar», nunca relleno con una proyección.
 */
function fila(h: Halving, precioHoy: number, formatFromUsd: (v: number) => string) {
  const suelo: CeldaDato = {
    valor: h.sueloCiclo == null ? '—' : formatFromUsd(h.sueloCiclo),
    nota: h.sueloFecha
      ? `${formatDateEs(h.sueloFecha)}${h.halvingEstimado ? ' · provisional' : ''}`
      : null,
  };

  if (!h.halvingEstimado) {
    return {
      suelo,
      halving: {
        valor: h.priceAtHalving == null ? '—' : formatFromUsd(h.priceAtHalving),
        nota: formatDateEs(h.fecha),
      } satisfies CeldaDato,
      techo: {
        valor: h.picoCiclo == null ? 'En curso' : formatFromUsd(h.picoCiclo),
        nota: h.picoFecha ? `${formatDateEs(h.picoFecha)}${h.cicloAbierto ? ' · puede subir' : ''}` : null,
      } satisfies CeldaDato,
      revalorizacion: {
        valor: h.sueloAPicoPct == null ? '—' : formatGainPct(h.sueloAPicoPct),
        nota: h.cicloAbierto ? 'ciclo abierto' : null,
      } satisfies CeldaDato,
    };
  }

  const desdeSuelo =
    h.sueloCiclo != null && h.sueloCiclo > 0
      ? Math.round(((precioHoy - h.sueloCiclo) / h.sueloCiclo) * 100)
      : null;
  return {
    suelo,
    halving: { valor: 'Por determinar', nota: `≈ ${mesAprox(h.fecha)} · estimado`, pendiente: true } satisfies CeldaDato,
    techo: { valor: 'Por determinar', nota: 'fecha por determinar', pendiente: true } satisfies CeldaDato,
    revalorizacion: {
      valor: 'Por determinar',
      nota: desdeSuelo == null ? null : `hoy ${formatGainPct(desdeSuelo)} sobre el suelo`,
      pendiente: true,
    } satisfies CeldaDato,
  };
}

function EnCurso() {
  return (
    <span className="mt-0.5 block w-fit rounded-full border border-btc/40 bg-btc/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-btc">
      Ciclo actual · en curso
    </span>
  );
}

function HalvingMobileCard({ halving, fila: f }: { halving: Halving; fila: ReturnType<typeof fila> }) {
  return (
    <div
      className={cx(
        'liquid-subcard rounded-xl p-3',
        halving.actual && 'ring-1 ring-btc/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-bold text-primary">Ciclo {halving.year}</span>
          {halving.actual && <EnCurso />}
        </span>
        <span className="shrink-0 text-xs text-muted">{halving.reward}</span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <Celda etiqueta="Suelo" c={f.suelo} tono="text-bear" />
        <Celda etiqueta="Halving" c={f.halving} tono="text-secondary" />
        <Celda etiqueta="Techo" c={f.techo} tono="text-bull" />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-bull/10 px-2.5 py-1.5">
        <span className="text-[10px] text-muted">Del suelo al techo</span>
        <span className="text-right">
          <span className={cx('block text-sm font-bold', f.revalorizacion.pendiente ? 'font-sans text-xs text-muted' : 'font-mono text-bull')}>
            {f.revalorizacion.valor}
          </span>
          {f.revalorizacion.nota && (
            <span className="block text-[10px] font-normal text-muted">{f.revalorizacion.nota}</span>
          )}
        </span>
      </div>
    </div>
  );
}

function Celda({ etiqueta, c, tono }: { etiqueta: string; c: CeldaDato; tono: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[10px] text-muted">{etiqueta}</span>
      <strong
        className={cx(
          'mt-0.5 block text-xs',
          c.pendiente ? 'font-sans text-[11px] font-semibold leading-tight text-muted' : `truncate font-mono ${tono}`,
        )}
      >
        {c.valor}
      </strong>
      {c.nota && <span className="mt-0.5 block text-[9px] leading-tight text-muted">{c.nota}</span>}
    </span>
  );
}

function CeldaTabla({ c, tono, bold }: { c: CeldaDato; tono: string; bold?: boolean }) {
  return (
    <td className={cx('py-3 pr-2 text-right font-mono', c.pendiente ? 'text-muted' : tono, bold && !c.pendiente && 'font-bold')}>
      {c.valor}
      {c.nota && <span className="block font-sans text-[10px] font-normal text-muted">{c.nota}</span>}
    </td>
  );
}

function Legend() {
  return <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-muted">
    {[['#22c55e', 'Picos'], ['#ef4444', 'Suelos'], ['#f59e0b', 'Actual']].map(([color, label]) => <span key={label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>)}
  </div>;
}

