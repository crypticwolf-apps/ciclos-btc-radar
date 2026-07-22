import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';
import type { MarketData, ScoreBlock } from '@/types';
import { Card } from '@/components/ui/Card';
import { RiskOpportunityScore } from '@/components/ui/RiskOpportunityScore';
import { CyclePhaseBadge } from '@/components/ui/CyclePhaseBadge';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { scoreColor } from '@/lib/score/opportunityScore';
import { cx, formatDateEs, formatPercent } from '@/lib/format';

// =============================================================================
// Vista «Oportunidad»: el ÚNICO sitio de la aplicación donde aparece el score.
//
// La idea es que el número no haya que creérselo: debajo está el desglose por
// bloques con su nota, su peso efectivo y los datos exactos que ha usado cada
// uno, más la confianza del cálculo y qué fuentes faltan.
// =============================================================================

const CONFIANZA_TEXTO: Record<string, string> = {
  alta: 'Todas o casi todas las fuentes han respondido.',
  media: 'Falta alguna fuente; los pesos se han redistribuido entre las disponibles.',
  baja: 'Faltan varias fuentes: el resultado es orientativo.',
};

export function SummarySection({ data }: { data: MarketData }) {
  const { opportunity, fase, bitcoin, indicators } = data;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden !p-4 sm:!p-6" accent={fase.color}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-btc/15 blur-3xl" />
        <div className="relative flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Termómetro de oportunidad
            </p>
            <h1 className="mt-1 text-xl font-extrabold text-primary sm:text-2xl">
              Contexto de mercado
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-secondary">
              {opportunity.resumen}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <CyclePhaseBadge fase={fase} />
              <span className="text-[11px] text-muted">
                RSI {indicators.rsi} · F&amp;G {indicators.fearGreed} ·{' '}
                {formatPercent(bitcoin.drawdownDesdeAth)} ATH
              </span>
            </div>
          </div>
          <RiskOpportunityScore opportunity={opportunity} />
        </div>

        {/* Confianza y cobertura: nunca se presenta el número como certeza. */}
        <div className="relative mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center">
          <span className="text-xs font-semibold text-secondary">
            Confianza{' '}
            <span
              className={cx(
                opportunity.confianza === 'alta'
                  ? 'text-bull'
                  : opportunity.confianza === 'media'
                    ? 'text-btc'
                    : 'text-bear',
              )}
            >
              {opportunity.confianza}
            </span>
          </span>
          <span className="text-[11px] text-muted">
            {opportunity.bloquesDisponibles} de {opportunity.bloquesTotales} bloques ·{' '}
            {opportunity.cobertura}% del peso
          </span>
          <span className="w-full text-[11px] leading-tight text-muted">
            {CONFIANZA_TEXTO[opportunity.confianza]}
            {opportunity.faltantes.length > 0 && ` Sin datos: ${opportunity.faltantes.join(', ')}.`}
          </span>
        </div>

        <p className="relative mt-3 text-center text-[10px] text-muted sm:text-xs">
          0 = riesgo máximo · 100 = contexto más favorable · media ponderada de siete bloques
          independientes
        </p>
      </Card>

      {(opportunity.suben.length > 0 || opportunity.bajan.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <ReasonList
            title="Qué eleva el score"
            icon={<TrendingUp size={16} className="text-bull" />}
            reasons={opportunity.suben}
            tone="bull"
          />
          <ReasonList
            title="Qué lo reduce"
            icon={<TrendingDown size={16} className="text-bear" />}
            reasons={opportunity.bajan}
            tone="bear"
          />
        </div>
      )}

      <Accordion
        title="Desglose por bloques"
        subtitle={`${opportunity.bloquesTotales} bloques con peso propio`}
      >
        <div className="space-y-2 pt-3">
          {opportunity.bloques.map((block: ScoreBlock) => (
            <BlockRow key={block.id} block={block} />
          ))}
        </div>
      </Accordion>

      <Accordion title="Cómo se calcula" subtitle="Metodología, en claro">
        <div className="space-y-2.5 pt-3 text-sm leading-relaxed text-secondary">
          <p>
            Cada bloque produce una nota de 0 a 100 a partir de sus propios datos y tiene un peso
            fijo. El score es la <strong className="text-primary">media ponderada</strong> de esas
            notas, así que ningún dato suelto puede mover el resultado entero: como mucho mueve su
            bloque.
          </p>
          <p>
            Si una fuente no responde, su bloque queda{' '}
            <strong className="text-primary">sin nota, no a cero</strong>. Tratar «no lo sé» como
            «cero» hundiría el score cada vez que fallara una API. En su lugar se reparte su peso
            entre los bloques que sí tienen datos y se rebaja la confianza declarada.
          </p>
          <p className="rounded-xl border border-bear/20 bg-bear/5 p-3 text-xs">
            La puntuación describe el contexto actual; no predice el precio ni elimina el riesgo de
            nuevas caídas. No es una recomendación de inversión.
          </p>
        </div>
      </Accordion>
    </div>
  );
}

function ReasonList({
  title,
  icon,
  reasons,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  reasons: string[];
  tone: 'bull' | 'bear';
}) {
  return (
    <Card className="!p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-primary">
        {icon} {title}
      </h2>
      {reasons.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Ningún bloque destaca en este sentido ahora mismo.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {reasons.map((reason) => (
            <li
              key={reason}
              className={cx(
                'rounded-lg border-l-2 bg-white/5 px-2.5 py-2 text-xs leading-relaxed text-secondary',
                tone === 'bull' ? 'border-bull' : 'border-bear',
              )}
            >
              {reason}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BlockRow({ block }: { block: ScoreBlock }) {
  const unavailable = block.score == null;
  const color = unavailable ? '#94a3b8' : scoreColor(block.score!);

  return (
    <details className="liquid-subcard group rounded-xl">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-primary">{block.label}</span>
          <span className="block truncate text-[11px] text-muted">
            {unavailable
              ? 'Sin datos · su peso se ha repartido'
              : `Peso ${block.effectiveWeight}% (nominal ${block.weight}%)`}
          </span>
        </span>
        <span
          className="shrink-0 rounded-lg px-2 py-1 font-mono text-sm font-bold tabular-nums"
          style={{ color, background: `${color}1f` }}
        >
          {unavailable ? '—' : block.score}
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-white/10 px-3 py-2.5">
        <p className="text-xs leading-relaxed text-secondary">{block.explanation}</p>
        {block.inputs.length > 0 && (
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {block.inputs.map((input) => (
              <div key={input.label} className="flex min-w-0 justify-between gap-2 text-[11px]">
                <dt className="truncate text-muted">{input.label}</dt>
                <dd className="shrink-0 font-mono text-secondary">{input.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {block.updatedAt && (
          <p className="mt-2 flex items-center gap-2 text-[10px] text-muted">
            <FreshnessTag freshness="diario" compact /> dato del {formatDateEs(block.updatedAt)}
          </p>
        )}
      </div>
    </details>
  );
}

function Accordion({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="!p-0">
      <details className="group" open>
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span>
            <span className="block text-sm font-bold text-primary sm:text-base">{title}</span>
            <span className="block text-xs text-muted">{subtitle}</span>
          </span>
          <ChevronDown
            size={18}
            className="shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-white/10 px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
      </details>
    </Card>
  );
}
