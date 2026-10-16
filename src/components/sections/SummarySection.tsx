import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';
import type { MarketData, ScoreBlock } from '@/types';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { ScoreHistoryCard } from './ScoreHistoryCard';
import { TermometroCard } from './TermometroCard';
import { Columnas } from '@/components/layout/Columnas';
import { riesgoDe, scoreColor } from '@/lib/score/opportunityScore';
import { cx, formatDateEs, formatNumberEs } from '@/lib/format';

// =============================================================================
// Vista «Temperatura» (Temperatura del mercado): el ÚNICO sitio de la aplicación
// donde aparece el score con su desglose.
//
// La idea es que el número no haya que creérselo: debajo está el desglose por
// bloques con su nota, su peso efectivo y los datos exactos que ha usado cada
// uno, más la confianza del cálculo y qué fuentes faltan.
//
// Aquí solo hay datos. Cómo se calcula el score y qué significa cada bloque se
// explica en Ajustes → Información, no repartido por las tarjetas.
//
// Todas las cifras se enseñan en su lectura de riesgo (`riesgoDe`): 0 = contexto
// más favorable, 100 = riesgo máximo, igual que el termómetro.
// =============================================================================


export function SummarySection({ data }: { data: MarketData }) {
  const { opportunity } = data;
  const hayMotivos = opportunity.suben.length > 0 || opportunity.bajan.length > 0;

  // En el orden del móvil. En escritorio estos cuadros van sueltos en la hoja
  // única (views/HojaEscritorio).
  return (
    <Columnas
      items={[
        { clave: 'termometro', nodo: <TermometroCard data={data} /> },
        ...(hayMotivos
          ? [
              {
                clave: 'motivos',
                nodo: (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <MotivosCard data={data} sentido="reduce" />
                    <MotivosCard data={data} sentido="aumenta" />
                  </div>
                ),
              },
            ]
          : []),
        { clave: 'desglose', nodo: <DesgloseCard data={data} /> },
        { clave: 'fase', nodo: <ScoreHistoryCard parte="fase" /> },
        { clave: 'evolucion', nodo: <ScoreHistoryCard parte="temperatura" /> },
      ]}
    />
  );
}

/** Qué reduce el riesgo (los bloques que suben la nota) o qué lo aumenta. */
export function MotivosCard({ data, sentido }: { data: MarketData; sentido: 'reduce' | 'aumenta' }) {
  const { opportunity } = data;
  return sentido === 'reduce' ? (
    <ReasonList
      title="Qué reduce el riesgo"
      icon={<TrendingDown size={16} className="text-bull" />}
      reasons={opportunity.suben}
      tone="bull"
    />
  ) : (
    <ReasonList
      title="Qué aumenta el riesgo"
      icon={<TrendingUp size={16} className="text-bear" />}
      reasons={opportunity.bajan}
      tone="bear"
    />
  );
}

/** Los bloques del cálculo, con su nota, su peso y los datos que usa cada uno. */
export function DesgloseCard({ data, columnas }: { data: MarketData; columnas?: boolean }) {
  const { opportunity } = data;
  return (
    <CollapsibleCard
      title="Desglose por bloques"
      subtitle={`${opportunity.bloquesTotales} bloques con peso propio`}
      titleClassName="text-primary"
    >
      {/* Con `columnas` (escritorio, a todo el ancho), los bloques se reparten en
          columnas en vez de una lista larguísima. */}
      <div className={columnas ? 'gap-2 [column-width:20rem] [&>*]:mb-2 [&>*]:break-inside-avoid' : 'space-y-2'}>
        {/* Del bloque que más pesa al que menos (peso nominal); a igual peso, el orden del cálculo. */}
        {[...opportunity.bloques].sort((a, b) => b.weight - a.weight).map((block: ScoreBlock) => (
          <BlockRow key={block.id} block={block} />
        ))}
      </div>
    </CollapsibleCard>
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
      // Una cifra suelta bajo el título parecía un subtítulo huérfano; como
      // chapa se lee por lo que es: cuántos motivos hay dentro.
      badge={
        <span
          className={cx(
            'inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-xs font-bold',
            tone === 'bull' ? 'border-bull/40 bg-bull/10 text-bull' : 'border-bear/40 bg-bear/10 text-bear',
          )}
        >
          {reasons.length}
        </span>
      }
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
    // Abierto de serie, como el resto de la app: se ve qué datos usa cada bloque sin tocar nada.
    <details open className="liquid-subcard group rounded-xl">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-primary">{block.label}</span>
          <span className="block truncate text-[11px] text-muted">
            {unavailable
              ? 'Sin datos · su peso se ha repartido'
              : `Peso ${formatNumberEs(block.effectiveWeight, 1)}% (nominal ${block.weight}%)`}
          </span>
        </span>
        <span
          className="shrink-0 rounded-lg px-2 py-1 font-mono text-sm font-bold tabular-nums"
          style={{ color, background: `${color}1f` }}
        >
          {unavailable ? '—' : riesgoDe(block.score!)}
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

