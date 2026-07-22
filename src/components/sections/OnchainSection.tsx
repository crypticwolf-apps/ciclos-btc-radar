import { Lock, Activity } from 'lucide-react';
import { useOnchainMetrics } from '@/hooks/useOnchainMetrics';
import type { OnchainMetric } from '@/types/onchain';
import { statusLabel, type SourceMeta } from '@/types/api';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cx, formatNumberEs, formatPercent, timeAgo, formatDateTimeMadrid } from '@/lib/format';

// =============================================================================
// Sección on-chain: métricas reales de la red Bitcoin (Blockchain.com +
// mempool.space, vía backend) y tarjetas premium bloqueadas cuando no hay
// proveedor avanzado (Glassnode/Dune) configurado.
// =============================================================================

const DEFINICIONES: Record<string, string> = {
  hashrate: 'Potencia de cómputo total que asegura la red. Más hashrate = más seguridad y convicción de los mineros.',
  difficulty: 'Dificultad de minado; se reajusta cada ~2 semanas para mantener bloques de ~10 minutos.',
  txPerDay: 'Transacciones confirmadas al día (media móvil de 7 días).',
  activeAddresses: 'Direcciones únicas activas al día; proxy de la amplitud de uso/retail.',
  mempoolBytes: 'Tamaño de las transacciones pendientes esperando confirmación.',
  supply: 'Bitcoins en circulación, de un máximo de 21 millones.',
};

const STATUS_DOT: Record<string, string> = {
  live: 'bg-emerald-500',
  cached: 'bg-sky-500',
  stale: 'bg-amber-500',
  unavailable: 'bg-red-500',
  locked: 'bg-zinc-500',
};

const PREMIUM = [
  { title: 'MVRV', desc: 'Valor de mercado frente a valor realizado; detecta sobre/infravaloración.' },
  { title: 'SOPR', desc: 'Ratio de beneficio del gasto: si las monedas se mueven en ganancia o pérdida.' },
  { title: 'Puell Multiple', desc: 'Ingresos de mineros vs su media anual; señala suelos y techos de ciclo.' },
  { title: 'LTH / STH Supply', desc: 'Oferta en manos de holders de largo vs corto plazo.' },
  { title: 'Accumulation Trend Score', desc: 'Intensidad de acumulación de las entidades grandes.' },
  { title: 'Flujos de ETFs spot', desc: 'Entradas/salidas netas de los ETFs spot de Bitcoin.' },
];

function fmtValue(m: OnchainMetric): string {
  switch (m.unit) {
    case 'EH/s':
      return formatNumberEs(m.value, 0);
    case 'T':
      return formatNumberEs(m.value, 1);
    case 'MB':
      return formatNumberEs(m.value, 2);
    case 'tx':
    case 'dir.':
    case 'BTC':
      return formatNumberEs(Math.round(m.value));
    default:
      return formatNumberEs(m.value, 2);
  }
}

function FreshnessBadge({ meta }: { meta: SourceMeta | undefined }) {
  if (!meta) return null;
  const ago = meta.fetchedAt ? ` · ${timeAgo(new Date(meta.fetchedAt))}` : '';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={`Fuente: ${meta.provider}`}>
      <span className={cx('h-2 w-2 rounded-full', STATUS_DOT[meta.status] ?? 'bg-zinc-500')} aria-hidden="true" />
      {statusLabel(meta.status)}
      {ago}
    </span>
  );
}

function MetricTile({ m }: { m: OnchainMetric }) {
  const def = DEFINICIONES[m.id] ?? '';
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-sm font-semibold text-secondary">
          {m.label}
          {def && <InfoTooltip text={def} />}
        </span>
        {m.changePct != null && (
          <span className={cx('font-mono text-xs', m.changePct >= 0 ? 'text-bull' : 'text-bear')}>
            {formatPercent(m.changePct)}
          </span>
        )}
      </div>
      <div className="font-mono text-2xl font-bold text-primary">{fmtValue(m)}</div>
      <div className="mt-0.5 text-xs text-muted">
        {m.unit} · {timeAgo(new Date(m.observedAt))}
      </div>
    </div>
  );
}

function LockedCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted">
        <Lock size={15} aria-hidden="true" />
        {title}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{desc}</p>
      <p className="mt-2 text-[11px] text-zinc-500">
        Requiere un proveedor on-chain avanzado configurado (Glassnode/Dune).
      </p>
    </div>
  );
}

export function OnchainSection() {
  const query = useOnchainMetrics();
  const data = query.data?.data;
  const sources = query.data?.meta.sources ?? [];
  const basicsMeta = sources.find((s) => s.provider === 'blockchain.com');
  const halvingMeta = sources.find((s) => s.provider === 'mempool.space');

  if (query.isLoading) return <Skeleton className="h-[480px]" />;
  if (query.isError || !data) {
    return (
      <ErrorState
        message={query.error?.message ?? 'No se pudieron cargar las métricas on-chain.'}
        onRetry={() => query.refetch()}
      />
    );
  }

  const metrics = data.basics?.metrics ?? [];
  const halving = data.halving;
  const fees = data.fees;

  return (
    <div className="space-y-6">
      {/* Métricas de red */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-xl font-bold text-btc">
            <Activity size={20} aria-hidden="true" /> Salud de la red (on-chain)
            <InfoTooltip text="Métricas reales de la cadena de Bitcoin (Blockchain.com y mempool.space, vía backend). Reflejan seguridad, uso y actividad de la red." />
          </h2>
          <FreshnessBadge meta={basicsMeta} />
        </div>
        {metrics.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-muted">
            Dato no disponible
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((m) => (
              <MetricTile key={m.id} m={m} />
            ))}
          </div>
        )}
      </Card>

      {/* Halving por altura de bloque real + comisiones */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-lg font-bold text-btc">
              Halving
              <InfoTooltip text="Progreso hacia la próxima reducción de la recompensa, derivado de la ALTURA DE BLOQUE real (no de una cuenta atrás fija). Estimación a ~10 min/bloque." />
            </h3>
            <FreshnessBadge meta={halvingMeta} />
          </div>
          {halving ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">Altura de bloque</span>
                <span className="font-mono text-lg font-bold text-primary">
                  {formatNumberEs(halving.blockHeight)}
                </span>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>Progreso del ciclo</span>
                  <span>{Math.round(halving.progress * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-btc" style={{ width: `${halving.progress * 100}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Bloques restantes</span>
                <span className="font-mono text-secondary">{formatNumberEs(halving.blocksRemaining)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Fecha estimada</span>
                <span className="text-secondary">{formatDateTimeMadrid(halving.estimatedDate)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Dato no disponible.</p>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-1.5 text-lg font-bold text-btc">
            Comisiones recomendadas
            <InfoTooltip text="Comisiones sugeridas en sat/vB según la congestión actual de la mempool (mempool.space)." />
          </h3>
          {fees ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Rápida', v: fees.fastestFee },
                { label: '30 min', v: fees.halfHourFee },
                { label: '1 hora', v: fees.hourFee },
                { label: 'Económica', v: fees.economyFee },
              ].map((f) => (
                <div key={f.label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <div className="font-mono text-2xl font-bold text-primary">{f.v}</div>
                  <div className="text-xs text-muted">sat/vB · {f.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Dato no disponible.</p>
          )}
        </Card>
      </div>

      {/* Premium bloqueado */}
      <Card>
        <h3 className="mb-1 flex items-center gap-1.5 text-lg font-bold text-btc">
          <Lock size={17} aria-hidden="true" /> Métricas on-chain avanzadas
        </h3>
        <p className="mb-4 text-sm text-muted">
          Estas métricas requieren un proveedor de pago (Glassnode/Dune). Se desbloquean al
          configurar su clave en el servidor.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PREMIUM.map((p) => (
            <LockedCard key={p.title} title={p.title} desc={p.desc} />
          ))}
        </div>
      </Card>
    </div>
  );
}
