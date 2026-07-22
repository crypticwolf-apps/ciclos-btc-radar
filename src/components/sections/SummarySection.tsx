import { ChevronDown } from 'lucide-react';
import type { MarketData, MarketSignal } from '@/types';
import { Card } from '@/components/ui/Card';
import { RiskOpportunityScore } from '@/components/ui/RiskOpportunityScore';
import { CyclePhaseBadge } from '@/components/ui/CyclePhaseBadge';
import { cx, formatPercent } from '@/lib/format';
import { useCurrency } from '@/contexts/CurrencyContext';

export function SummarySection({ data }: { data: MarketData }) {
  const { opportunity, fase, bitcoin, indicators } = data;
  const { formatCompactFromUsd } = useCurrency();
  const formatSignal = (signal: MarketSignal) => signal.id === 'etf'
    ? `${formatCompactFromUsd(data.etf.inflowsRecientes * 1_000_000_000, { signDisplay: 'always' })} recientes`
    : signal.detalle;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden !p-4 sm:!p-6" accent={fase.color}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-btc/15 blur-3xl" />
        <div className="relative flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">TermÃ³metro de oportunidad</p>
            <h1 className="mt-1 text-xl font-extrabold text-primary sm:text-2xl">Contexto de mercado</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-secondary">{opportunity.resumen}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <CyclePhaseBadge fase={fase} />
              <span className="text-[11px] text-muted">RSI {indicators.rsi} Â· F&amp;G {indicators.fearGreed} Â· {formatPercent(bitcoin.drawdownDesdeAth)} ATH</span>
            </div>
          </div>
          <RiskOpportunityScore opportunity={opportunity} />
        </div>
        <p className="relative mt-3 text-center text-[10px] text-muted sm:text-xs">0 = riesgo mÃ¡ximo Â· 100 = oportunidad histÃ³rica Â· cÃ¡lculo transparente por seÃ±ales ponderadas</p>
      </Card>

      <Accordion title="Factores del score" subtitle={`${opportunity.senales.length} seÃ±ales ponderadas`}>
        <div className="grid gap-2 pt-3 sm:grid-cols-2">
          {opportunity.senales.map((signal) => <SignalRow key={signal.id} signal={signal} detail={formatSignal(signal)} />)}
        </div>
      </Accordion>

      <Accordion title="Por quÃ© da este resultado" subtitle="Lectura conjunta de precio, ciclo, sentimiento e instituciones">
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-3">
          <Factor label="CaÃ­da desde ATH" value={formatPercent(bitcoin.drawdownDesdeAth)} note="ValoraciÃ³n relativa" />
          <Factor label="RSI (14d)" value={String(indicators.rsi)} note={indicators.rsi < 30 ? 'Sobreventa' : 'Momentum'} />
          <Factor label="Fear & Greed" value={String(indicators.fearGreed)} note={indicators.fearGreedLabel} />
          <Factor label="Ballenas" value="Acumulando" note="Manos fuertes" />
          <Factor label="ETFs" value={formatCompactFromUsd(data.etf.inflowsTotales * 1_000_000_000)} note="Flujos acumulados" />
          <Factor label="ISM" value={String(data.macro.ismActual)} note={data.macro.ismActual >= 50 ? 'ExpansiÃ³n' : 'ContracciÃ³n'} />
        </div>
      </Accordion>

      <Accordion title="Riesgos a vigilar" subtitle="QuÃ© podrÃ­a invalidar o empeorar la lectura actual">
        <div className="space-y-2 pt-3">
          {opportunity.senales.filter((signal) => signal.tipo === 'negativo').length > 0 ? opportunity.senales.filter((signal) => signal.tipo === 'negativo').map((signal) => <SignalRow key={signal.id} signal={signal} detail={formatSignal(signal)} />) : <p className="text-sm text-muted">No hay una seÃ±al negativa dominante, pero la volatilidad, la liquidez y el contexto macro pueden cambiar rÃ¡pidamente.</p>}
          <p className="rounded-xl border border-bear/20 bg-bear/5 p-3 text-xs leading-relaxed text-secondary">La puntuaciÃ³n describe el contexto actual; no predice el precio ni elimina el riesgo de nuevas caÃ­das.</p>
        </div>
      </Accordion>
    </div>
  );
}

function Accordion({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className="!p-0">
      <details className="group">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span><span className="block text-sm font-bold text-primary sm:text-base">{title}</span><span className="block text-xs text-muted">{subtitle}</span></span>
          <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-white/10 px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
      </details>
    </Card>
  );
}

function SignalRow({ signal, detail }: { signal: MarketSignal; detail: string }) {
  const color = signal.tipo === 'positivo' ? '#22c55e' : signal.tipo === 'negativo' ? '#ef4444' : '#94a3b8';
  return (
    <div className="liquid-subcard flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2.5">
      <div className="min-w-0"><p className="truncate text-xs font-semibold text-primary sm:text-sm">{signal.label}</p><p className="truncate text-[10px] text-muted sm:text-xs">{detail}</p></div>
      <span className={cx('shrink-0 rounded-lg px-2 py-1 font-mono text-xs font-bold')} style={{ color, background: `${color}1f` }}>{signal.peso > 0 ? '+' : ''}{signal.peso}</span>
    </div>
  );
}

function Factor({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="liquid-subcard min-w-0 rounded-xl p-3"><p className="truncate text-[10px] text-muted">{label}</p><p className="truncate font-mono text-lg font-extrabold text-btc">{value}</p><p className="truncate text-[10px] text-secondary">{note}</p></div>;
}
