import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useScoreHistory, type PhaseHistory } from '@/hooks/useScoreHistory';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { SegmentedControl } from '@/components/ui/Controls';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { useCurrency } from '@/contexts/CurrencyContext';
import { PHASES } from '@/data/phases';
import { PHASE_FROM_CODE } from '@/lib/cycle/phaseRule';
import { scoreColor, scoreLabel } from '@/lib/score/opportunityScore';
import type { DailySnapshot } from '@/lib/score/snapshot';
import type { CyclePhaseId } from '@/types';
import { cx, formatDateEs, formatNumberEs } from '@/lib/format';

// =============================================================================
// La evolución, en dos tarjetas:
//
//   · Fase del ciclo desde 2018: reconstruida en el servidor día a día con las
//     MISMAS reglas y datos que la fase de hoy (precio, RSI, tendencia y Fear &
//     Greed de cada día). Está siempre, desde el primer día.
//   · Score de Oportunidad: un punto al día guardado por el servidor (Redis).
//     El score NO se puede reconstruir hacia atrás —derivados, liquidez y macro
//     no tienen serie histórica— así que empieza el día en que se activó.
// =============================================================================

const DAY = 86_400_000;
/** «2026-10-03» a fecha legible, a mediodía UTC para no cambiar de día por la zona horaria. */
const dia = (day: string) => formatDateEs(`${day}T12:00:00Z`);
const diaDe = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const corto = (day: string) => {
  const [, m, d] = day.split('-');
  return `${Number(d)}/${Number(m)}`;
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesAño = (day: string) => `${MESES[Number(day.slice(5, 7)) - 1]} ${day.slice(2, 4)}`;

type Rango = '90' | '365' | 'todo';
const RANGOS: { value: Rango; label: string }[] = [
  { value: '90', label: '90 d' },
  { value: '365', label: '1 año' },
  { value: 'todo', label: 'Desde 2018' },
];

interface Tramo {
  fase: CyclePhaseId;
  desde: string;
  hasta: string;
  dias: number;
}

/** Tramos seguidos con la misma fase. */
function tramos(items: { day: string; fase: CyclePhaseId }[]): Tramo[] {
  const out: Tramo[] = [];
  for (const d of items) {
    const last = out[out.length - 1];
    if (last && last.fase === d.fase) {
      last.hasta = d.day;
      last.dias += 1;
    } else out.push({ fase: d.fase, desde: d.day, hasta: d.day, dias: 1 });
  }
  return out;
}

export function ScoreHistoryCard() {
  const q = useScoreHistory();
  const res = q.data?.data;

  if (q.isLoading) return <Skeleton className="h-40" />;
  if (!res) return null;

  return (
    <>
      {res.fases && res.fases.fases.length > 1 && <PhaseHistoryCard h={res.fases} />}
      {res.configured && <ScoreCard days={res.days} />}
    </>
  );
}

// --- Fase del ciclo desde 2018 -------------------------------------------------

function PhaseHistoryCard({ h }: { h: PhaseHistory }) {
  const { formatFromUsd } = useCurrency();
  const [rango, setRango] = useState<Rango>('365');

  const todos = useMemo(() => {
    const t0 = Date.parse(`${h.desde}T00:00:00Z`);
    return [...h.fases].map((code, i) => ({
      day: diaDe(t0 + i * DAY),
      fase: PHASE_FROM_CODE[code] ?? 'acumulacion',
      precio: h.precios[i] ?? null,
    }));
  }, [h]);

  const vista = rango === 'todo' ? todos : todos.slice(-Number(rango));
  const segmentos = tramos(vista);
  // Una línea no necesita más de ~400 puntos; la franja usa todos los días.
  const paso = Math.max(1, Math.ceil(vista.length / 400));
  const puntos = vista.filter((_, i) => i % paso === 0 || i === vista.length - 1);
  const cambios = [...segmentos].reverse().slice(0, 5);
  const hoy = todos[todos.length - 1]!;

  // Tiempo en cada fase dentro del periodo elegido, de más a menos.
  const reparto = Object.entries(
    vista.reduce<Record<string, number>>((acc, d) => ((acc[d.fase] = (acc[d.fase] ?? 0) + 1), acc), {}),
  ).sort((a, b) => b[1] - a[1]) as [CyclePhaseId, number][];

  return (
    <CollapsibleCard
      title="La fase del ciclo, día a día"
      titleClassName="text-primary"
      subtitle={`Desde ${dia(h.desde)} · hoy: ${PHASES[hoy.fase]?.nombre ?? hoy.fase}`}
      info="Cada día calculado con las mismas reglas que la fase de hoy y los datos de ese día: caída desde el máximo (mejor cierre hasta entonces), tendencia frente a la media de 30 días, RSI de 14 días y Fear & Greed. Empieza en febrero de 2018 porque es cuando empieza el índice de miedo y codicia."
    >
      <div className="space-y-3">
        <SegmentedControl options={RANGOS} value={rango} onChange={setRango} size="sm" />

        <div className="h-40 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={puntos} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="day"
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickFormatter={rango === 'todo' ? (d: string) => d.slice(0, 4) : mesAño}
                minTickGap={28}
              />
              <YAxis hide scale="log" domain={['auto', 'auto']} />
              <Tooltip
                content={
                  <ChartTooltip
                    renderBody={(d) => {
                      const p = d as unknown as (typeof puntos)[number];
                      return (
                        <div className="space-y-0.5 text-xs">
                          <p className="text-[11px] text-muted">{dia(p.day)}</p>
                          {p.precio != null && <p className="font-bold text-primary">{formatFromUsd(p.precio)}</p>}
                          <p style={{ color: PHASES[p.fase]?.color }}>{PHASES[p.fase]?.nombre ?? p.fase}</p>
                        </div>
                      );
                    }}
                  />
                }
              />
              {/* Línea neutra: los colores son de las fases, y el naranja es el de la euforia. */}
              <Line type="monotone" dataKey="precio" stroke="var(--text-secondary)" strokeWidth={1.6} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Franja de fases, alineada con el gráfico: cada tramo ocupa lo que duró. */}
        <div className="-mt-1 flex h-3 overflow-hidden rounded-full" role="img" aria-label="Fase del ciclo por días">
          {segmentos.map((t) => (
            <div
              key={t.desde}
              title={`${PHASES[t.fase]?.nombre ?? t.fase}: ${dia(t.desde)} – ${dia(t.hasta)}`}
              style={{ flexGrow: t.dias, background: PHASES[t.fase]?.color ?? '#94a3b8' }}
            />
          ))}
        </div>

        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          {reparto.map(([fase, n]) => (
            <li key={fase} className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PHASES[fase]?.color }} />
              {PHASES[fase]?.nombre ?? fase} {Math.round((n / vista.length) * 100)}%
            </li>
          ))}
        </ul>

        <div>
          <p className="mb-1 text-[11px] font-semibold text-secondary">Últimos cambios</p>
          <ul className="space-y-1 text-[11px] text-muted">
            {cambios.map((t) => (
              <li key={t.desde} className="flex items-start gap-1.5">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: PHASES[t.fase]?.color }} />
                <span>
                  {dia(t.desde)}: {t !== segmentos[0] ? 'pasa a ' : rango === 'todo' ? 'empieza en ' : ''}
                  <span className="font-semibold text-secondary">{PHASES[t.fase]?.nombre ?? t.fase}</span>
                  {t === segmentos[0] && rango !== 'todo' ? ' (inicio del periodo)' : ''} · {formatNumberEs(t.dias)}{' '}
                  {t.dias === 1 ? 'día' : 'días'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CollapsibleCard>
  );
}

// --- Score de Oportunidad --------------------------------------------------------

/** Score de hace `dias` días (o el más cercano anterior). */
function hace(days: DailySnapshot[], dias: number): DailySnapshot | null {
  const last = days[days.length - 1];
  if (!last) return null;
  const objetivo = Date.parse(last.day) - dias * DAY;
  let found: DailySnapshot | null = null;
  for (const d of days) if (Date.parse(d.day) <= objetivo) found = d;
  return found;
}

function ScoreCard({ days }: { days: DailySnapshot[] }) {
  const last = days[days.length - 1];
  return (
    <CollapsibleCard
      title="Evolución del score"
      titleClassName="text-primary"
      subtitle={
        days.length > 0
          ? `${formatNumberEs(days.length)} ${days.length === 1 ? 'día' : 'días'} guardados desde el ${dia(days[0]!.day)}`
          : 'Se guarda un punto al día'
      }
      info="Un punto por día con el score de ese día, calculado igual que el termómetro. Empieza el día en que se activó: el pasado no se reconstruye porque derivados, liquidez y macro no tienen serie histórica."
    >
      {days.length < 2 || !last ? (
        <p className="text-xs leading-relaxed text-muted">
          El histórico del score acaba de empezar{last ? ` (hoy: ${last.score})` : ''}. Se añade un punto
          cada día; el gráfico aparece en cuanto haya dos.
        </p>
      ) : (
        <ScoreBody days={days} />
      )}
    </CollapsibleCard>
  );
}

function ScoreBody({ days }: { days: DailySnapshot[] }) {
  const last = days[days.length - 1]!;
  const puntos = days.map((d) => ({ ...d, fecha: corto(d.day) }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Delta etiqueta="Hoy" valor={last.score} />
        <Delta etiqueta="vs 7 días" valor={last.score} base={hace(days, 7)?.score ?? null} />
        <Delta etiqueta="vs 30 días" valor={last.score} base={hace(days, 30)?.score ?? null} />
      </div>

      <div className="h-48 sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={puntos} margin={{ top: 12, right: 8, left: -6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis dataKey="fecha" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} minTickGap={24} />
            <YAxis domain={[0, 100]} ticks={[0, 35, 50, 65, 100]} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={36} />
            <ReferenceLine y={65} stroke="#22c55e" strokeOpacity={0.35} strokeDasharray="4 4" />
            <ReferenceLine y={35} stroke="#ef4444" strokeOpacity={0.35} strokeDasharray="4 4" />
            <Tooltip
              content={
                <ChartTooltip
                  renderBody={(d) => {
                    const s = d as unknown as DailySnapshot;
                    return (
                      <div className="space-y-0.5 text-xs">
                        <p className="text-[11px] text-muted">{dia(s.day)}</p>
                        <p className="font-bold" style={{ color: scoreColor(s.score) }}>
                          {s.score} · {scoreLabel(s.score)}
                        </p>
                        <p style={{ color: PHASES[s.fase]?.color }}>Fase: {PHASES[s.fase]?.nombre ?? s.fase}</p>
                        <p className="text-muted">Confianza {s.confianza}</p>
                      </div>
                    );
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="score"
              name="Score"
              stroke="#f59e0b"
              strokeWidth={2}
              isAnimationActive={false}
              dot={days.length <= 60 ? { r: 2.5, fill: '#f59e0b' } : false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Delta({ etiqueta, valor, base }: { etiqueta: string; valor: number; base?: number | null }) {
  const diff = base == null ? null : valor - base;
  const mostrar = base === undefined ? String(valor) : diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff}`;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-center">
      <p className="text-[10px] text-muted">{etiqueta}</p>
      <p
        className={cx(
          'font-mono text-sm font-bold',
          base === undefined ? '' : diff == null ? 'text-muted' : diff > 0 ? 'text-bull' : diff < 0 ? 'text-bear' : 'text-secondary',
        )}
        style={base === undefined ? { color: scoreColor(valor) } : undefined}
      >
        {mostrar}
      </p>
    </div>
  );
}
