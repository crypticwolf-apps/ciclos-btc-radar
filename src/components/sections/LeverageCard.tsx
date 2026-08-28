import { useMemo } from 'react';
import { Flame, Zap } from 'lucide-react';
import type { MarketData } from '@/types';
import { useLiveLiquidations } from '@/hooks/useRealtime';
import { useCurrency } from '@/contexts/CurrencyContext';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { cx, formatNumberEs, formatPercent, timeAgo } from '@/lib/format';

// =============================================================================
// «Apalancamiento del mercado»: reúne funding, open interest, liquidaciones y
// posicionamiento en una sola lectura en lenguaje llano.
//
// Norma de redacción de esta tarjeta: describe lo que ESTÁ pasando y qué riesgo
// implica, y nunca afirma hacia dónde irá el precio. Un funding alto significa
// que mantener largos cuesta dinero y que hay más riesgo de liquidaciones en
// cadena; no significa que el precio vaya a caer.
//
// Los datos vienen del servidor (`/api/dashboard`), que prueba Binance, OKX y
// Bybit por ese orden. Antes los pedía el navegador directamente a Binance y
// la tarjeta se quedaba vacía para cualquiera que lo tuviera bloqueado: por
// país, por la red de su empresa o por una extensión. Las liquidaciones sí
// siguen llegando por WebSocket, porque no existen como consulta REST; si ese
// canal no abre, se pierde esa cifra y el resto de la tarjeta sigue en pie.
// =============================================================================

/** Explica en una frase el estado del apalancamiento a partir de los datos. */
function readLeverage(
  fundingPct8h: number | null,
  oiChange: number | null,
  longShort: number | null,
): { titular: string; detalle: string; tono: 'bull' | 'bear' | 'neutral' } {
  const calienteLargos = fundingPct8h != null && fundingPct8h > 0.03;
  const calienteCortos = fundingPct8h != null && fundingPct8h < -0.01;
  const oiSube = oiChange != null && oiChange > 3;
  const oiBaja = oiChange != null && oiChange < -3;

  if (calienteLargos && oiSube) {
    return {
      titular: 'Apalancamiento alcista tensionado',
      detalle:
        'Los largos pagan a los cortos y hay cada vez más contratos abiertos. Mantener posiciones largas cuesta dinero y una caída brusca puede encadenar liquidaciones.',
      tono: 'bear',
    };
  }
  if (calienteCortos && oiSube) {
    return {
      titular: 'Presión bajista apalancada',
      detalle:
        'Los cortos pagan a los largos con el interés abierto creciendo. Un rebote rápido puede forzar el cierre de esos cortos.',
      tono: 'bull',
    };
  }
  if (oiBaja) {
    return {
      titular: 'Desapalancamiento en curso',
      detalle:
        'El interés abierto baja: se están cerrando posiciones. Suele reducir el riesgo de liquidaciones en cadena a corto plazo.',
      tono: 'neutral',
    };
  }
  if (longShort != null && longShort > 2) {
    return {
      titular: 'Posicionamiento muy cargado al alza',
      detalle:
        'Hay bastantes más cuentas largas que cortas. Los extremos de posicionamiento suelen preceder a movimientos volátiles, en cualquier dirección.',
      tono: 'neutral',
    };
  }
  return {
    titular: 'Apalancamiento en niveles normales',
    detalle:
      'Ni el coste de financiación ni el interés abierto muestran tensión destacable en este momento.',
    tono: 'neutral',
  };
}

export function LeverageCard({ data }: { data: MarketData }) {
  const { formatCompactFromUsd, formatFromUsd } = useCurrency();
  const liq = useLiveLiquidations();
  const d = data.derivatives;

  // El funding se publica por periodo de 8 h; se muestra en % para que se lea.
  const fundingPct8h = d?.fundingRate != null ? d.fundingRate * 100 : null;
  const fundingAnnualPct = fundingPct8h != null ? fundingPct8h * 3 * 365 : null;

  const lectura = useMemo(
    () => readLeverage(fundingPct8h, d?.openInterestChange24hPct ?? null, d?.longShortRatio ?? null),
    [fundingPct8h, d?.openInterestChange24hPct, d?.longShortRatio],
  );

  const nextFunding =
    d?.nextFundingAt != null && d.nextFundingAt > Date.now()
      ? Math.round((d.nextFundingAt - Date.now()) / 60_000)
      : null;

  return (
    <CollapsibleCard
      title="Apalancamiento del mercado"
      icon={<Zap size={19} aria-hidden="true" />}
      info="Resume el mercado de futuros perpetuos de BTC: cuánto cuesta mantener posiciones (funding), cuántos contratos hay abiertos y qué se está liquidando. Los datos vienen del primer exchange que responda —Binance, OKX o Bybit— y la tarjeta indica cuál fue. Describe el riesgo actual; no predice el precio."
      badge={
        d == null ? (
          <FreshnessTag freshness="no-disponible" />
        ) : (
          <FreshnessTag freshness="actualizado" at={data.lastUpdated} source={`${d.source} · perpetuos`} />
        )
      }
    >

      {d == null ? (
        <p className="text-sm text-muted">
          Ningún mercado de derivados ha respondido. La tarjeta vuelve sola en cuanto lo haga.
        </p>
      ) : (
        <>
          <div
            className={cx(
              'rounded-xl border-l-2 bg-white/5 px-3.5 py-3',
              lectura.tono === 'bull'
                ? 'border-bull'
                : lectura.tono === 'bear'
                  ? 'border-bear'
                  : 'border-white/25',
            )}
          >
            <p className="text-sm font-bold text-primary">{lectura.titular}</p>
            <p className="mt-1 text-xs leading-relaxed text-secondary">{lectura.detalle}</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric
              label="Funding (8 h)"
              value={fundingPct8h != null ? `${fundingPct8h >= 0 ? '+' : ''}${fundingPct8h.toFixed(4)}%` : '—'}
              tone={fundingPct8h == null ? 'neutral' : fundingPct8h >= 0 ? 'bull' : 'bear'}
              hint={
                fundingAnnualPct != null
                  ? `≈ ${fundingAnnualPct.toFixed(1)}% anual · ${fundingPct8h! >= 0 ? 'pagan los largos' : 'pagan los cortos'}`
                  : undefined
              }
            />
            <Metric
              label="Próximo funding"
              value={nextFunding != null ? `${Math.floor(nextFunding / 60)} h ${nextFunding % 60} min` : '—'}
              tone="neutral"
            />
            <Metric
              label="Interés abierto"
              value={d.openInterestBtc == null ? '—' : `${formatNumberEs(d.openInterestBtc, 0)} BTC`}
              tone="neutral"
              hint={d.openInterestUsd != null ? formatCompactFromUsd(d.openInterestUsd) : undefined}
            />
            <Metric
              label="Cambio 24 h"
              value={d.openInterestChange24hPct != null ? formatPercent(d.openInterestChange24hPct) : '—'}
              tone={
                d.openInterestChange24hPct == null
                  ? 'neutral'
                  : d.openInterestChange24hPct >= 0
                    ? 'bull'
                    : 'bear'
              }
              hint="contratos abiertos"
            />
            <Metric
              label="Cuentas largas"
              value={d.longAccountPct != null ? `${d.longAccountPct}%` : '—'}
              tone="neutral"
              hint={d.longShortRatio != null ? `ratio ${d.longShortRatio.toFixed(2)}` : undefined}
            />
            <Metric
              label="Taker compra/venta"
              value={d.takerBuySellRatio != null ? d.takerBuySellRatio.toFixed(2) : '—'}
              tone={
                d.takerBuySellRatio == null
                  ? 'neutral'
                  : d.takerBuySellRatio >= 1
                    ? 'bull'
                    : 'bear'
              }
              hint="volumen agresor, 1 h"
            />
            <Metric
              label="Mark price"
              value={d.markPrice != null ? formatFromUsd(d.markPrice) : '—'}
              tone="neutral"
              hint={d.indexPrice != null ? `índice ${formatFromUsd(d.indexPrice)}` : undefined}
            />
            <Metric
              label="Liquidado (sesión)"
              value={
                liq.liquidations.length > 0
                  ? formatCompactFromUsd(liq.liquidatedLongsUsd + liq.liquidatedShortsUsd)
                  : '—'
              }
              tone="neutral"
              hint={
                liq.liquidations.length > 0
                  ? `${formatCompactFromUsd(liq.liquidatedLongsUsd)} largos · ${formatCompactFromUsd(liq.liquidatedShortsUsd)} cortos`
                  : undefined
              }
            />
          </div>

          <Liquidations liq={liq} />
        </>
      )}
    </CollapsibleCard>
  );
}

function Liquidations({ liq }: { liq: ReturnType<typeof useLiveLiquidations> }) {
  const { formatCompactFromUsd } = useCurrency();

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-bold text-secondary">
          <Flame size={15} aria-hidden="true" /> Liquidaciones recientes
          <InfoTooltip text="Posiciones cerradas a la fuerza por el exchange al agotarse su garantía. Llegan en directo por WebSocket, según ocurren. Que no aparezca ninguna significa mercado tranquilo, no un fallo." />
        </h4>
        {liq.waiting ? (
          <span className="text-xs text-muted">Escuchando…</span>
        ) : liq.isLive ? (
          <FreshnessTag freshness="vivo" source="Binance · stream de liquidaciones" />
        ) : (
          <FreshnessTag freshness="no-disponible" source="Binance" />
        )}
      </div>

      {liq.liquidations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-xs text-muted">
          {liq.waiting
            ? 'Conectado. Todavía no ha ocurrido ninguna liquidación: en mercados tranquilos pueden pasar minutos.'
            : 'Canal de liquidaciones no disponible ahora mismo.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {liq.liquidations.slice(0, 5).map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs"
            >
              <span
                className={cx('shrink-0 font-semibold', l.side === 'SELL' ? 'text-bear' : 'text-bull')}
              >
                {l.side === 'SELL' ? 'Largos' : 'Cortos'}
              </span>
              <span className="font-mono text-secondary">{formatCompactFromUsd(l.valueUsd)}</span>
              <span className="shrink-0 text-muted">{timeAgo(new Date(l.at))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: 'bull' | 'bear' | 'neutral';
  hint?: string;
}) {
  const color = tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : 'text-primary';
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-2.5">
      <p className="truncate text-[10px] leading-tight text-muted">{label}</p>
      <p className={cx('truncate font-mono text-base font-bold tabular-nums', color)}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[10px] leading-tight text-muted">{hint}</p>}
    </div>
  );
}
