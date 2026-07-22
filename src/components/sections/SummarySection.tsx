import type { MarketData, MarketSignal } from '@/types';
import { Card } from '@/components/ui/Card';
import { InsightCard } from '@/components/ui/InsightCard';
import { RiskOpportunityScore } from '@/components/ui/RiskOpportunityScore';
import { CyclePhaseBadge } from '@/components/ui/CyclePhaseBadge';
import { cx, formatPercent } from '@/lib/format';
import { CheckCircle2, XCircle, MinusCircle, Quote } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';

interface SectionProps {
  data: MarketData;
}

export function SummarySection({ data }: SectionProps) {
  const { opportunity, fase, bitcoin, indicators } = data;
  const positivas = opportunity.senales.filter((s) => s.tipo === 'positivo');
  const negativas = opportunity.senales.filter((s) => s.tipo === 'negativo');
  const neutrales = opportunity.senales.filter((s) => s.tipo === 'neutral');
  const { formatCompactFromUsd } = useCurrency();
  const formatSignalDetail = (signal: MarketSignal) =>
    signal.id === 'etf'
      ? `${formatCompactFromUsd(data.etf.inflowsRecientes * 1_000_000_000, {
          signDisplay: 'always',
        })} recientes`
      : signal.detalle;

  return (
    <div className="space-y-6">
      {/* Score principal */}
      <Card className="relative overflow-hidden" accent={fase.color}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-btc/15 blur-3xl" />
        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col items-center lg:items-start">
            <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Termómetro de oportunidad
            </span>
            <h2 className="text-center text-2xl font-bold text-primary lg:text-left">
              Contexto de mercado
            </h2>
            <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-secondary lg:text-left">
              {opportunity.resumen}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <CyclePhaseBadge fase={fase} />
              <span className="text-xs text-muted">
                RSI {indicators.rsi} · F&amp;G {indicators.fearGreed} ·{' '}
                {formatPercent(bitcoin.drawdownDesdeAth)} ATH
              </span>
            </div>
          </div>
          <RiskOpportunityScore opportunity={opportunity} />
        </div>
        <p className="relative mt-4 text-center text-xs text-muted">
          Escala 0-100 · 0 = riesgo máximo · 100 = oportunidad histórica. Calculado a partir de las
          señales que se muestran debajo.
        </p>
      </Card>

      {/* Señales positivas vs riesgo */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SignalColumn
          title="Señales a favor"
          icon={<CheckCircle2 size={18} className="text-bull" />}
          color="#22c55e"
          signals={positivas}
          detailFormatter={formatSignalDetail}
        />
        <SignalColumn
          title="Señales de riesgo"
          icon={<XCircle size={18} className="text-bear" />}
          color="#ef4444"
          signals={negativas}
          detailFormatter={formatSignalDetail}
          empty="Ninguna señal de riesgo destacada ahora mismo."
        />
      </div>

      {neutrales.length > 0 && (
        <SignalColumn
          title="Señales neutrales"
          icon={<MinusCircle size={18} className="text-muted" />}
          color="#94a3b8"
          signals={neutrales}
          detailFormatter={formatSignalDetail}
        />
      )}

      {/* Por qué ahora */}
      <Card className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(234,88,12,0.06))' }}
        />
        <h3 className="relative mb-5 text-center text-xl font-bold text-btc">
          ⚡ La tesis, en una pantalla
        </h3>
        <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['📉', 'Caída desde el ATH', formatPercent(bitcoin.drawdownDesdeAth), 'En zona de corrección/oportunidad histórica'],
            ['📊', 'RSI (14d)', String(indicators.rsi), indicators.rsi < 30 ? 'Sobreventa histórica' : 'Momentum a vigilar'],
            ['😱', 'Fear & Greed', String(indicators.fearGreed), indicators.fearGreedLabel],
            ['🐋', 'Ballenas', 'Acumulando', 'Manos fuertes aumentan balance'],
            ['🏦', 'ETFs', `${formatCompactFromUsd(data.etf.inflowsTotales * 1_000_000_000)}+`, 'Acumulación institucional estructural'],
            ['🏭', 'ISM', String(data.macro.ismActual), data.macro.ismActual >= 50 ? 'Economía en expansión' : 'Economía en contracción'],
          ].map(([icon, title, val, sub]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-[var(--surface-strong)] p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                <span className="text-sm font-semibold text-primary">{title}</span>
              </div>
              <p className="font-mono text-xl font-bold text-bull">{val}</p>
              <p className="mt-0.5 text-xs text-muted">{sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Conclusión */}
      <Card>
        <h3 className="mb-4 text-center text-xl font-bold text-primary">🎯 La conclusión</h3>
        <div className="mx-auto max-w-2xl space-y-2.5 text-center">
          <p className="text-secondary">El pánico del retail tiende a crear oportunidad para el dinero paciente.</p>
          <p className="text-secondary">Las manos fuertes suelen acumular cuando el miedo es máximo.</p>
          <p className="text-secondary">Y el ciclo económico, al mejorar, puede actuar de catalizador.</p>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="flex items-center justify-center gap-2 text-lg font-bold text-btc">
              <Quote size={18} /> «Sé codicioso cuando otros tienen miedo».
            </p>
            <p className="mt-1 text-sm text-muted">— Warren Buffett</p>
          </div>
        </div>
      </Card>

      <InsightCard rgb="239,68,68" title="⚠️ Antes de actuar, recuerda">
        Los datos históricos no garantizan resultados futuros. Bitcoin puede caer mucho más y
        durante mucho tiempo. Este panel es educativo y no constituye consejo financiero. Define tu
        propia estrategia, tu tolerancia al riesgo y nunca inviertas más de lo que puedas permitirte
        perder.
      </InsightCard>
    </div>
  );
}

function SignalColumn({
  title,
  icon,
  color,
  signals,
  empty,
  detailFormatter,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  signals: MarketSignal[];
  empty?: string;
  detailFormatter?: (signal: MarketSignal) => string;
}) {
  return (
    <Card className="!p-5">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-primary">
        {icon} {title}
        <span className="ml-auto text-sm text-muted">{signals.length}</span>
      </h3>
      {signals.length === 0 ? (
        <p className="text-sm text-muted">{empty ?? 'Sin señales en esta categoría.'}</p>
      ) : (
        <ul className="space-y-2">
          {signals.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-primary">{s.label}</p>
                <p className="text-xs leading-snug text-muted">{detailFormatter?.(s) ?? s.detalle}</p>
              </div>
              <span
                className={cx('shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-bold')}
                style={{ background: `${color}1f`, color }}
              >
                {s.peso > 0 ? '+' : ''}
                {s.peso}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
