import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useScoreHistory } from '@/hooks/useScoreHistory';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { PHASES } from '@/data/phases';
import { scoreColor, scoreLabel } from '@/lib/score/opportunityScore';
import type { DailySnapshot } from '@/lib/score/snapshot';
import { cx, formatDateEs, formatNumberEs } from '@/lib/format';

// =============================================================================
// Evolución del Score de Oportunidad y de la fase del ciclo, un punto al día.
//
// Lo guarda el servidor (ver api/_lib/scoreHistory.ts) con las mismas funciones
// que calculan el score de la pantalla, así que el punto de hoy coincide con el
// termómetro. Empieza el día en que se activó: no se reconstruye el pasado,
// porque varias de sus fuentes (derivados, liquidez, macro) no tienen histórico
// y el resultado no sería el mismo cálculo.
//
// Sin almacén configurado en el servidor la tarjeta no aparece.
// =============================================================================

const DAY = 86_400_000;
/** «2026-10-03» a fecha legible, a mediodía UTC para no cambiar de día por la zona horaria. */
const dia = (day: string) => formatDateEs(`${day}T12:00:00Z`);
const corto = (day: string) => {
  const [, m, d] = day.split('-');
  return `${Number(d)}/${Number(m)}`;
};

/** Score de hace `dias` días (o el más cercano anterior). */
function hace(days: DailySnapshot[], dias: number): DailySnapshot | null {
  const last = days[days.length - 1];
  if (!last) return null;
  const objetivo = Date.parse(last.day) - dias * DAY;
  let found: DailySnapshot | null = null;
  for (const d of days) if (Date.parse(d.day) <= objetivo) found = d;
  return found;
}

/** Tramos seguidos con la misma fase, para la franja y la lista de cambios. */
function tramos(days: DailySnapshot[]) {
  const out: { fase: DailySnapshot['fase']; desde: string; hasta: string; dias: number }[] = [];
  for (const d of days) {
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
  if (!res?.configured) return null;

  const days = res.days;
  const last = days[days.length - 1];

  return (
    <CollapsibleCard
      title="Evolución del score y de la fase"
      titleClassName="text-primary"
      subtitle={
        days.length > 0
          ? `${formatNumberEs(days.length)} ${days.length === 1 ? 'día' : 'días'} guardados desde el ${dia(days[0]!.day)}`
          : 'Se guarda un punto al día'
      }
      info="Un punto por día: el score y la fase con los datos de ese día, calculados igual que el termómetro. El histórico empieza el día en que se activó; no se reconstruye el pasado porque derivados, liquidez y macro no tienen serie histórica."
    >
      {days.length < 2 || !last ? (
        <p className="text-xs leading-relaxed text-muted">
          El histórico acaba de empezar
          {last ? ` (hoy: ${last.score}, ${PHASES[last.fase]?.nombre ?? last.fase})` : ''}. Se añade un
          punto cada día; el gráfico aparece en cuanto haya dos.
        </p>
      ) : (
        <ScoreHistoryBody days={days} />
      )}
    </CollapsibleCard>
  );
}

function ScoreHistoryBody({ days }: { days: DailySnapshot[] }) {
  const last = days[days.length - 1]!;
  const segmentos = tramos(days);
  // Del más reciente al más antiguo; el primero es el arranque del histórico.
  const cambios = [...segmentos].reverse().slice(0, 5);
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

      {/* Franja de fases: cada tramo ocupa lo que duró. */}
      <div>
        <p className="mb-1 text-[11px] font-semibold text-secondary">Fase del ciclo</p>
        <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label="Fases del ciclo por días">
          {segmentos.map((t) => (
            <div
              key={t.desde}
              title={`${PHASES[t.fase]?.nombre ?? t.fase}: ${dia(t.desde)} – ${dia(t.hasta)}`}
              style={{ flexGrow: t.dias, background: PHASES[t.fase]?.color ?? '#94a3b8' }}
            />
          ))}
        </div>
        <ul className="mt-2 space-y-1 text-[11px] text-muted">
          {cambios.map((t) => (
            <li key={t.desde} className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PHASES[t.fase]?.color }} />
              {dia(t.desde)}: {t === segmentos[0] ? 'empieza en' : 'pasa a'}{' '}
              <span className="font-semibold text-secondary">{PHASES[t.fase]?.nombre ?? t.fase}</span>
              <span>· {formatNumberEs(t.dias)} {t.dias === 1 ? 'día' : 'días'}</span>
            </li>
          ))}
        </ul>
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
