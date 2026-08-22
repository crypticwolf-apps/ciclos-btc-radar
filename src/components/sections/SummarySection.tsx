import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';
import type { MarketData, ScoreBlock } from '@/types';
import { CollapsibleCard } from '@/components/ui/Collapsible';
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
//
// Aquí solo hay datos. Cómo se calcula el score y qué significa cada bloque se
// explica en Ajustes → Información, no repartido por las tarjetas.
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
      <CollapsibleCard
        title="Termómetro de oportunidad"
        subtitle="Contexto de mercado"
        titleClassName="text-primary"
        badge={<CyclePhaseBadge fase={fase} />}
      >
        <div className="relative flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
          <div className="text-center lg:text-left">
            <p className="max-w-xl text-sm leading-relaxed text-secondary">
              {opportunity.resumen}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="text-[11px] text-muted">
                RSI {indicators.rsi ?? '—'} · F&amp;G {indicators.fearGreed ?? '—'} ·{' '}
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
          0 = riesgo máximo · 100 = contexto más favorable
        </p>
      </CollapsibleCard>

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

      <CollapsibleCard
        title="Desglose por bloques"
        subtitle={`${opportunity.bloquesTotales} bloques con peso propio`}
        titleClassName="text-primary"
      >
        <div className="space-y-2">
          {opportunity.bloques.map((block: ScoreBlock) => (
            <BlockRow key={block.id} block={block} />
          ))}
        </div>
      </CollapsibleCard>
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
    <CollapsibleCard
      title={title}
      titleClassName="text-primary"
      icon={icon}
      badge={<span className="text-xs text-muted">{reasons.length}</span>}
    >
      {reasons.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Ningún bloque destaca en este sentido ahora mismo.</p>
      ) : (
        <ul className="space-y-1.5">
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
    </CollapsibleCard>
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

