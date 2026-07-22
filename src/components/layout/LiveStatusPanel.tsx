import { RefreshCw, X } from 'lucide-react';
import type { DataSource } from '@/types';
import { statusLabel, type DataStatus } from '@/types/api';
import { useHealth } from '@/hooks/useHealth';
import { cx, timeAgo } from '@/lib/format';

interface LiveStatusPanelProps {
  source: DataSource;
  lastUpdated: Date | null;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onClose: () => void;
}

const STATUS_DOT: Record<DataStatus, string> = {
  live: 'bg-emerald-500',
  cached: 'bg-sky-500',
  stale: 'bg-amber-500',
  locked: 'bg-zinc-500',
  unavailable: 'bg-red-500',
};

export function LiveStatusPanel({
  source,
  lastUpdated,
  refreshing,
  error,
  onRefresh,
  onClose,
}: LiveStatusPanelProps) {
  const health = useHealth();
  const report = health.data?.data;
  const offline = Boolean(error) || (health.isError && !report);
  const updating = refreshing || health.isFetching;

  const refreshAll = () => {
    onRefresh();
    void health.refetch();
  };

  return (
    <section
      id="live-status-panel"
      aria-label="Estado de conexiÃ³n y fuentes"
      className="glass-strong absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[calc(100vw-1.25rem)] max-w-[350px] rounded-[22px] p-3.5 shadow-2xl sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-primary">
            <span className={cx('h-2.5 w-2.5 rounded-full', offline ? 'bg-red-500' : updating ? 'bg-amber-400' : 'bg-emerald-500')} />
            {offline ? 'ConexiÃ³n no disponible' : updating ? 'Actualizando datos' : 'Datos conectados'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {lastUpdated ? `Ãšltima actualizaciÃ³n ${timeAgo(lastUpdated)}` : 'Esperando la primera actualizaciÃ³n'}
            {' Â· '}{source === 'live' ? 'fuentes reales' : source === 'stale' ? 'Ãºltimo dato vÃ¡lido' : 'modo de reserva'}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar estado" className="liquid-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted">
          <X size={16} />
        </button>
      </div>

      {report ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {report.providers.map((provider) => (
            <div key={provider.label} className="liquid-subcard min-w-0 rounded-xl px-2.5 py-2">
              <p className="truncate text-[11px] font-semibold text-secondary">{provider.label}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[provider.status])} />
                {statusLabel(provider.status)} Â· {provider.latencyMs} ms
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-white/10 px-3 py-2 text-xs text-muted">
          {health.isLoading ? 'Comprobando las fuentesâ€¦' : health.error?.message ?? 'No se pudo comprobar el estado.'}
        </p>
      )}

      <button
        type="button"
        onClick={refreshAll}
        disabled={updating}
        className="liquid-action mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-secondary disabled:opacity-60"
      >
        <RefreshCw size={14} className={cx(updating && 'animate-spin')} />
        Actualizar ahora
      </button>
    </section>
  );
}
