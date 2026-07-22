import { Blocks } from 'lucide-react';
import { useNetwork } from '@/hooks/useNetwork';
import { Card } from '@/components/ui/Card';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { FreshnessTag, freshnessFromStatus } from '@/components/ui/FreshnessTag';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { cx, formatNumberEs, formatPercent, timeAgo } from '@/lib/format';

// =============================================================================
// «Red Bitcoin»: estado real de la cadena en una tarjeta compacta.
//
// Se resiste a la tentación de volcar veinte cifras: se muestran las cuatro que
// se entienden de un vistazo (congestión, comisión, seguridad y último bloque)
// y el resto se explica en una línea de texto.
// =============================================================================

export function NetworkCard() {
  const query = useNetwork();
  const data = query.data?.data;
  const sources = query.data?.meta.sources ?? [];
  const feesStatus = sources.find((s) => s.provider.includes('fees'))?.status;
  const strengthStatus = sources.find((s) => s.provider.includes('hashrate'))?.status;

  if (query.isLoading) return <Skeleton className="h-64" />;
  if (query.isError || !data) {
    return (
      <Card>
        <h3 className="mb-2 flex items-center gap-1.5 text-lg font-bold text-btc">
          <Blocks size={19} aria-hidden="true" /> Red Bitcoin
        </h3>
        <p className="text-sm text-muted">Estado de la red no disponible ahora mismo.</p>
      </Card>
    );
  }

  const { fees, mempool, strength, latestBlock } = data;
  const congestion =
    mempool == null
      ? null
      : mempool.blocksToClear <= 3
        ? { label: 'Despejada', tone: 'text-bull' }
        : mempool.blocksToClear <= 20
          ? { label: 'Con cola', tone: 'text-btc' }
          : { label: 'Congestionada', tone: 'text-bear' };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-lg font-bold text-btc">
          <Blocks size={19} aria-hidden="true" /> Red Bitcoin
          <InfoTooltip text="Estado real de la cadena: cuántas transacciones esperan, cuánto cuesta entrar en el próximo bloque y cuánta potencia de cálculo protege la red. Datos de mempool.space." />
        </h3>
        <FreshnessTag
          freshness={freshnessFromStatus(feesStatus ?? strengthStatus)}
          at={query.dataUpdatedAt}
          source="mempool.space"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile
          label="Comisión rápida"
          value={fees ? `${fees.fastestFee}` : '—'}
          unit="sat/vB"
          hint={fees ? `económica ${fees.economyFee}` : undefined}
        />
        <Tile
          label="En espera"
          value={mempool ? formatNumberEs(mempool.pendingTx) : '—'}
          unit="transacciones"
          hint={congestion?.label}
          valueClass={congestion?.tone}
        />
        <Tile
          label="Hashrate"
          value={strength ? formatNumberEs(strength.hashrateEhs) : '—'}
          unit="EH/s"
          hint={strength ? `dificultad ${formatNumberEs(strength.difficultyT, 1)} T` : undefined}
        />
        <Tile
          label="Último bloque"
          value={latestBlock ? formatNumberEs(latestBlock.height) : '—'}
          unit={latestBlock ? timeAgo(new Date(latestBlock.minedAt)) : ''}
          hint={latestBlock ? `${formatNumberEs(latestBlock.txCount)} tx` : undefined}
        />
      </div>

      {strength && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-semibold text-secondary">
              Próximo ajuste de dificultad
              <InfoTooltip text="Cada 2016 bloques (unas dos semanas) la red recalibra la dificultad para que los bloques sigan saliendo cada 10 minutos de media." />
            </span>
            <span
              className={cx(
                'font-mono font-bold',
                strength.nextAdjustmentPct >= 0 ? 'text-bull' : 'text-bear',
              )}
            >
              {formatPercent(strength.nextAdjustmentPct)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-btc transition-[width] duration-700"
              style={{ width: `${strength.retargetProgressPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-tight text-muted">
            {formatNumberEs(strength.blocksToRetarget)} bloques restantes · bloque cada{' '}
            {strength.avgBlockMinutes} min de media
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Fuente: mempool.space · comisiones y mempool cada minuto; hashrate y dificultad cada 30 min.
      </p>
    </Card>
  );
}

function Tile({
  label,
  value,
  unit,
  hint,
  valueClass,
}: {
  label: string;
  value: string;
  unit: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="truncate text-[10px] leading-tight text-muted">{label}</p>
      <p className={cx('truncate font-mono text-lg font-bold tabular-nums text-primary', valueClass)}>
        {value}
      </p>
      <p className="truncate text-[10px] leading-tight text-muted">{unit}</p>
      {hint && <p className="mt-0.5 truncate text-[10px] leading-tight text-muted">{hint}</p>}
    </div>
  );
}
