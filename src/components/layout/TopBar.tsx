import { Moon, RefreshCw, Sun, Wifi } from 'lucide-react';
import type { DataSource, Theme } from '@/types';
import type { Currency } from '@/types/market';
import { cx } from '@/lib/format';
import { DataFreshnessBadge } from '@/components/ui/DataFreshnessBadge';
import { SegmentedControl } from '@/components/ui/Controls';
import { useCurrency } from '@/contexts/CurrencyContext';

interface TopBarProps {
  theme: Theme;
  onToggleTheme: () => void;
  source: DataSource;
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function TopBar({
  theme,
  onToggleTheme,
  source,
  lastUpdated,
  refreshing,
  onRefresh,
}: TopBarProps) {
  const { currency, setCurrency, rateSource } = useCurrency();
  const rateLabel =
    rateSource === 'market'
      ? 'Tipo de cambio del mercado en vivo'
      : rateSource === 'cached'
        ? 'Usando el último tipo de cambio válido'
        : 'Usando un tipo de cambio de reserva';

  return (
    <header className="liquid-header sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="brand-orb flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-white">
              <img src="/btc.svg" alt="" className="h-full w-full" width="40" height="40" />
            </span>
            <div className="hidden min-w-0 leading-tight min-[360px]:block">
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

            <div role="group" aria-label="Moneda global" title={rateLabel}>
              <SegmentedControl<Currency>
                size="sm"
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'eur', label: 'EUR' },
                  { value: 'usd', label: 'USD' },
                ]}
                className="[&>button]:px-2"
              />
            </div>

            <button
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Actualizar datos"
              className="liquid-icon-button flex h-11 w-11 items-center justify-center rounded-xl text-secondary disabled:opacity-60"
            >
              <RefreshCw size={17} className={cx(refreshing && 'animate-spin')} />
            </button>

            <button
              onClick={onToggleTheme}
              aria-label="Cambiar tema"
              className="liquid-icon-button flex h-11 w-11 items-center justify-center rounded-xl text-secondary"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end sm:hidden">
          <DataFreshnessBadge source={source} lastUpdated={lastUpdated} compact />
        </div>
      </div>
    </header>
  );
}
