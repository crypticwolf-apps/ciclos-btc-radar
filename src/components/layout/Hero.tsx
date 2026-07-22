import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Copy, Download } from 'lucide-react';
import type { MarketData } from '@/types';
import { cx, formatPercent, formatUsd } from '@/lib/format';
import { buildMarketSummary } from '@/lib/summary';
import { CyclePhaseBadge } from '@/components/ui/CyclePhaseBadge';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface HeroProps {
  data: MarketData;
}

export function Hero({ data }: HeroProps) {
  const { bitcoin, fase, opportunity } = data;
  const up = bitcoin.cambio24h >= 0;
  const [copied, setCopied] = useState(false);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildMarketSummary(data));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <section className="glass liquid-hero relative overflow-hidden rounded-[26px] p-5 sm:rounded-[32px] sm:p-8 animate-fade-in">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-btc/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-macro/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <CyclePhaseBadge fase={fase} />
            <span className="text-xs text-muted">
              Fase estimada del ciclo
              <InfoTooltip text="Fase calculada automáticamente combinando drawdown, RSI, Fear & Greed, tendencia y flujos. Es una estimación, no una certeza." />
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <span className="hero-price font-mono font-extrabold tabular-nums tracking-[-0.06em] text-primary">
                {formatUsd(bitcoin.precio)}
              </span>
              <span
                className={cx(
                  'mb-1 inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-sm font-bold',
                  up ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear',
                )}
              >
                {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {formatPercent(bitcoin.cambio24h)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">Bitcoin · precio actual · cambio 24h</p>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-secondary">
            <span className="font-semibold text-primary">{opportunity.etiqueta}.</span>{' '}
            {opportunity.resumen}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={copySummary}
              className="liquid-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-secondary sm:px-3.5 sm:text-sm"
            >
              {copied ? <Check size={15} className="text-bull" /> : <Copy size={15} />}
              {copied ? 'Copiado' : 'Copiar resumen'}
            </button>
            <button
              onClick={() => window.print()}
              className="liquid-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-secondary sm:px-3.5 sm:text-sm"
            >
              <Download size={15} /> Exportar / Imprimir
            </button>
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 gap-2.5 sm:max-w-xs sm:gap-3">
          <HeroStat
            label="Caída desde ATH"
            value={formatPercent(bitcoin.drawdownDesdeAth)}
            tone="bear"
          />
          <HeroStat label="Días desde ATH" value={String(bitcoin.diasDesdeAth)} tone="neutral" />
          <HeroStat
            label="ATH"
            value={formatUsd(bitcoin.ath)}
            tone="btc"
          />
          <HeroStat
            label="Para volver al ATH"
            value={formatPercent(bitcoin.recuperacionNecesaria)}
            tone="bull"
          />
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'btc' | 'bull' | 'bear' | 'neutral';
}) {
  const color =
    tone === 'btc'
      ? 'text-btc'
      : tone === 'bull'
        ? 'text-bull'
        : tone === 'bear'
          ? 'text-bear'
          : 'text-primary';
  return (
    <div className="liquid-subcard rounded-2xl p-3.5">
      <p className={cx('font-mono text-lg font-bold tabular-nums', color)}>{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}
