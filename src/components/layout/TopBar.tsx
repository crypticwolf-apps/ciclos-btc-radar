import { useEffect, useRef, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { DataSource } from '@/types';
import { cx } from '@/lib/format';
import { setAllCollapsibles } from '@/lib/collapseAll';
import { LiveStatusPanel } from './LiveStatusPanel';

// Barra superior: la moneda de Bitcoin en 3D (la de las barras líquidas), el
// nombre con «BTC» en degradado naranja, los controles redondos, el estado en
// vivo con su brillo y una línea de neón abajo.

/** La moneda de Bitcoin en 3D, como en las barras líquidas. */
function MonedaBtc() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="h-8 w-8 shrink-0 drop-shadow-[0_6px_14px_rgba(247,147,26,0.55)] sm:h-9 sm:w-9">
      <defs>
        <radialGradient id="barra-moneda" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff1d6" />
          <stop offset="35%" stopColor="#ffb547" />
          <stop offset="75%" stopColor="#f7931a" />
          <stop offset="100%" stopColor="#a35400" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="21.5" r="17" fill="#8a4b00" />
      <circle cx="20" cy="20" r="17" fill="url(#barra-moneda)" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
      <text x="20" y="26.5" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff">
        ₿
      </text>
      <ellipse cx="13" cy="11" rx="6" ry="3" fill="#fff" opacity="0.6" transform="rotate(-25 13 11)" />
    </svg>
  );
}

interface TopBarProps {
  source: DataSource;
  lastUpdated: Date | null;
  refreshing: boolean;
  error: string | null;
  /** Datos guardados y la renovación ha fallado. */
  sinConexion?: boolean;
  onRefresh: () => void;
}

export function TopBar({ source, lastUpdated, refreshing, error, sinConexion = false, onRefresh }: TopBarProps) {
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

  const estado = error || sinConexion ? 'sin-conexion' : refreshing ? 'actualizando' : 'vivo';

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
          <div className="flex min-w-0 items-center gap-2">
            <MonedaBtc />
            <p className="truncate text-sm font-black tracking-tight min-[360px]:text-base sm:text-lg">
              <span className="text-primary">Ciclos </span>
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-orange-600 bg-clip-text text-transparent">BTC</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <div
              role="group"
              aria-label="Moneda global"
              title={rateLabel}
              className="liquid-control grid grid-cols-2 rounded-full p-0.5"
            >
              {(['eur', 'usd'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCurrency(value)}
                  aria-pressed={currency === value}
                  className={cx(
                    'min-h-9 rounded-full px-2.5 text-[10px] font-black uppercase sm:px-3 sm:text-xs',
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
              className="liquid-action inline-flex h-9 w-9 items-center justify-center rounded-full text-secondary sm:h-10 sm:w-10"
            >
              {allOpen ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
            </button>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="live-status-panel"
              aria-label={`Estado: ${estado === 'sin-conexion' ? 'sin conexión' : estado === 'actualizando' ? 'actualizando' : 'en vivo'}. Ver las fuentes de datos`}
              title="Estado de las fuentes de datos"
              className={cx(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wide sm:h-10 sm:px-3 sm:text-xs',
                estado === 'sin-conexion'
                  ? 'border-red-500/40 bg-red-500/10 text-red-500 shadow-[0_0_14px_-4px_rgba(239,68,68,0.8)]'
                  : estado === 'actualizando'
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-500 shadow-[0_0_14px_-4px_rgba(251,191,36,0.8)]'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 shadow-[0_0_14px_-4px_rgba(16,185,129,0.8)]',
              )}
            >
              {/* El punto late: está vivo (o reintentando). */}
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span
                  className={cx(
                    'absolute inline-flex h-full w-full rounded-full opacity-70 motion-safe:animate-ping',
                    estado === 'sin-conexion' ? 'bg-red-400' : estado === 'actualizando' ? 'bg-amber-300' : 'bg-emerald-400',
                  )}
                />
                <span
                  className={cx(
                    'relative inline-flex h-2 w-2 rounded-full',
                    estado === 'sin-conexion' ? 'bg-red-500' : estado === 'actualizando' ? 'bg-amber-400' : 'bg-emerald-500',
                  )}
                />
              </span>
              {estado === 'sin-conexion' ? 'Offline' : 'Live'}
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
      {/* Línea de neón */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-90" aria-hidden="true" />
    </header>
  );
}
