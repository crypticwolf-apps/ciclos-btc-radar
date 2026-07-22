import { Moon, RefreshCw, Sun, Bitcoin, Wifi } from 'lucide-react';
import type { DataSource, Theme, ViewMode } from '@/types';
import { cx } from '@/lib/format';
import { DataFreshnessBadge } from '@/components/ui/DataFreshnessBadge';
import { SegmentedControl } from '@/components/ui/Controls';

interface TopBarProps {
  theme: Theme;
  onToggleTheme: () => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  source: DataSource;
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function TopBar({
  theme,
  onToggleTheme,
  viewMode,
  onViewModeChange,
  source,
  lastUpdated,
  refreshing,
  onRefresh,
}: TopBarProps) {
  return (
    <header className="liquid-header sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="brand-orb flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white">
              <Bitcoin size={21} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-extrabold tracking-tight text-primary sm:text-base">Ciclos BTC</p>
              <p className="hidden text-[11px] text-muted sm:block">
                Radar del ciclo de Bitcoin
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden lg:flex lg:items-center lg:gap-2">
              <DataFreshnessBadge source={source} lastUpdated={lastUpdated} />
              <span className="liquid-status inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-secondary">
                <Wifi size={12} className="text-bull" /> Datos sincronizados
              </span>
            </div>

            <div className="hidden sm:block">
              <SegmentedControl<ViewMode>
                size="sm"
                value={viewMode}
                onChange={onViewModeChange}
                options={[
                  { value: 'principiante', label: 'Básico' },
                  { value: 'avanzado', label: 'Avanzado' },
                ]}
              />
            </div>

            <button
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Actualizar datos"
              className="liquid-icon-button flex h-10 w-10 items-center justify-center rounded-xl text-secondary disabled:opacity-60"
            >
              <RefreshCw size={17} className={cx(refreshing && 'animate-spin')} />
            </button>

            <button
              onClick={onToggleTheme}
              aria-label="Cambiar tema"
              className="liquid-icon-button flex h-10 w-10 items-center justify-center rounded-xl text-secondary"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3 sm:hidden">
          <SegmentedControl<ViewMode>
            size="sm"
            value={viewMode}
            onChange={onViewModeChange}
            options={[
              { value: 'principiante', label: 'Básico' },
              { value: 'avanzado', label: 'Avanzado' },
            ]}
            className="flex-1 [&>button]:flex-1"
          />
          <DataFreshnessBadge source={source} lastUpdated={lastUpdated} compact className="shrink-0" />
        </div>
      </div>
    </header>
  );
}
