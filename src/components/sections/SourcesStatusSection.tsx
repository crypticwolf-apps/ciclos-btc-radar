import { RefreshCw } from 'lucide-react';
import { useHealth } from '@/hooks/useHealth';
import { statusLabel, type DataStatus, type ProviderProbe } from '@/types/api';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cx, formatDateTimeMadrid, timeAgo } from '@/lib/format';

// =============================================================================
// Panel "Estado de fuentes": prueba cada proveedor vía /api/health y muestra
// estado, última respuesta válida (hora de Madrid), latencia y notas.
// =============================================================================

const STATUS_STYLE: Record<DataStatus, { dot: string; text: string }> = {
  live: { dot: 'bg-emerald-500', text: 'text-emerald-400' },
  cached: { dot: 'bg-sky-500', text: 'text-sky-400' },
  stale: { dot: 'bg-amber-500', text: 'text-amber-400' },
  locked: { dot: 'bg-zinc-500', text: 'text-zinc-400' },
  unavailable: { dot: 'bg-red-500', text: 'text-red-400' },
};

function StatusBadge({ status }: { status: DataStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm font-semibold', s.text)}>
      <span className={cx('h-2 w-2 rounded-full', s.dot)} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

function ProviderRow({ p }: { p: ProviderProbe }) {
  return (
    <tr className="border-t border-white/5">
      <th scope="row" className="py-3 pr-4 text-left font-medium text-secondary">
        {p.label}
        <span className="block font-mono text-xs text-muted">{p.provider}</span>
      </th>
      <td className="py-3 pr-4">
        <StatusBadge status={p.status} />
        {p.note && <span className="block text-xs text-muted">{p.note}</span>}
      </td>
      <td className="py-3 pr-4 text-sm text-secondary">
        {p.fetchedAt ? formatDateTimeMadrid(p.fetchedAt) : '—'}
      </td>
      <td className="py-3 text-right font-mono text-sm text-muted">{p.latencyMs} ms</td>
    </tr>
  );
}

export function SourcesStatusSection() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useHealth();
  const report = data?.data;

  if (isLoading) return <Skeleton className="h-[420px]" />;
  if (isError || !report) {
    return (
      <ErrorState
        message={error?.message ?? 'No se pudo obtener el estado de las fuentes.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-xl font-bold text-btc">
              Estado de fuentes
              <InfoTooltip text="Prueba en tiempo real cada proveedor de datos. 'No disponible' = la fuente falló; 'Requiere proveedor' = falta configurar su clave en el servidor." />
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {report.healthy} de {report.total} fuentes operativas · actualizado{' '}
              {timeAgo(new Date(dataUpdatedAt))}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Actualizar estado de fuentes"
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-secondary transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw size={15} className={cx(isFetching && 'animate-spin')} aria-hidden="true" />
            Actualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">Estado de cada proveedor de datos del dashboard</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th scope="col" className="pb-2 pr-4 font-semibold">Fuente</th>
                <th scope="col" className="pb-2 pr-4 font-semibold">Estado</th>
                <th scope="col" className="pb-2 pr-4 font-semibold">Última respuesta (Madrid)</th>
                <th scope="col" className="pb-2 text-right font-semibold">Latencia</th>
              </tr>
            </thead>
            <tbody>
              {report.providers.map((p) => (
                <ProviderRow key={p.provider} p={p} />
              ))}
            </tbody>
          </table>
        </div>

        {!report.macroConfigured && (
          <p className="mt-4 rounded-xl border-l-2 border-amber-500/60 bg-amber-500/5 px-4 py-3 text-sm text-secondary">
            El bloque macro (FRED) está bloqueado: configura <code className="font-mono">FRED_API_KEY</code>{' '}
            en el servidor para activarlo.
          </p>
        )}
      </Card>
    </div>
  );
}
