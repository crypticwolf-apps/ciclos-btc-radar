import { useEffect, useRef, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { DataSource } from '@/types';
import { cx } from '@/lib/format';
import { setAllCollapsibles } from '@/lib/collapseAll';
import { LiveStatusPanel } from './LiveStatusPanel';

interface TopBarProps {
  source: DataSource;
  lastUpdated: Date | null;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function TopBar({ source, lastUpdated, refreshing, error, onRefresh }: TopBarProps) {
  const { currency, setCurrency, rateSource } = useCurrency();
  const [open, setOpen] = useState(false);
  // Los cuadros nacen abiertos, así que el botón empieza ofreciendo plegar.
  const [allOpen, setAllOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const rateLabel =
    rateSource === 'market'
      ? 'Tipo de cambio del mercado en vivo'
      : rateSource === 'cached'
        ? 'Último tipo de cambio válido'
        : 'Tipo de cambio de reserva';

  return (
    <header className="liquid-header relative z-40">
      <div className="mx-auto max-w-7xl px-2.5 py-2 sm:px-6">
        <div className="relative flex items-center justify-between gap-2" ref={containerRef}>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="brand-orb flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white sm:h-9 sm:w-9">
              <img src="/btc.svg" alt="" className="h-full w-full" width="36" height="36" />
            </span>
            <p className="truncate text-xs font-extrabold tracking-tight text-primary min-[360px]:text-sm sm:text-base">
              Ciclos BTC
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <div
              role="group"
              aria-label="Moneda global"
              title={rateLabel}
              className="liquid-control grid grid-cols-2 rounded-xl p-0.5"
            >
              {(['eur', 'usd'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCurrency(value)}
                  aria-pressed={currency === value}
                  className={cx(
                    'min-h-9 rounded-[9px] px-2 text-[10px] font-bold uppercase sm:px-2.5 sm:text-xs',
                    currency === value ? 'liquid-control-active text-white' : 'text-muted',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setAllCollapsibles(!allOpen);
                setAllOpen((value) => !value);
              }}
              title={allOpen ? 'Plegar todos los cuadros' : 'Desplegar todos los cuadros'}
              aria-label={allOpen ? 'Plegar todos los cuadros' : 'Desplegar todos los cuadros'}
              className="liquid-action inline-flex h-10 w-10 items-center justify-center rounded-xl text-secondary"
            >
              {allOpen ? <ChevronsDownUp size={17} /> : <ChevronsUpDown size={17} />}
            </button>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="live-status-panel"
              className="liquid-action inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-[10px] font-bold text-secondary sm:px-3 sm:text-xs"
            >
              <span className={cx('h-2 w-2 rounded-full', error ? 'bg-red-500' : refreshing ? 'bg-amber-400' : 'bg-emerald-500')} />
              {error ? 'Sin conexión' : refreshing ? 'Actualizando' : 'En vivo'}
            </button>
          </div>

          {open && (
            <LiveStatusPanel
              source={source}
              lastUpdated={lastUpdated}
              refreshing={refreshing}
              error={error}
              onRefresh={onRefresh}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      </div>
    </header>
  );
}
