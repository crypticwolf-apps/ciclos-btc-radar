import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { MarketData } from '@/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card } from '@/components/ui/Card';
import { CyclePhaseBadge } from '@/components/ui/CyclePhaseBadge';
import { cx, formatNumberEs, formatPercent } from '@/lib/format';

export function HomeView({ data }: { data: MarketData }) {
  const { formatFromUsd } = useCurrency();
  const up = data.bitcoin.cambio24h >= 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="liquid-hero !p-4 sm:!p-6" accent={data.fase.color}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CyclePhaseBadge fase={data.fase} />
          <span className="text-[11px] text-muted">Fase estimada del ciclo</span>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2.5">
          <h1 className="font-mono text-[2rem] font-extrabold leading-none tracking-[-0.05em] text-primary sm:text-5xl">
            {formatFromUsd(data.bitcoin.precio)}
          </h1>
          <span className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold', up ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear')}>
            {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
            {formatPercent(data.bitcoin.cambio24h)}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-secondary">
          <span className="font-semibold text-primary">{data.opportunity.etiqueta}.</span>{' '}
          {data.opportunity.resumen}
        </p>
        <div className="liquid-action mt-4 inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-bold text-secondary">
          Oportunidad {data.opportunity.score}/100
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <MiniMetric label="Desde ATH" value={formatPercent(data.bitcoin.drawdownDesdeAth)} tone="text-bear" />
        <MiniMetric label="Miedo y codicia" value={String(data.indicators.fearGreed)} tone="text-btc" />
        <MiniMetric label="Días al halving" value={formatNumberEs(data.halvingInfo.diasHastaProximoHalving)} tone="text-macro" />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="glass liquid-card min-w-0 rounded-2xl p-2.5 text-center sm:p-4">
      <p className={cx('truncate font-mono text-base font-extrabold tabular-nums sm:text-xl', tone)}>{value}</p>
      <p className="mt-1 text-[9px] leading-tight text-muted min-[360px]:text-[10px] sm:text-xs">{label}</p>
    </div>
  );
}

