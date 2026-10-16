import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Settings2, X } from 'lucide-react';
import { cx } from '@/lib/format';

// =============================================================================
// Escritorio: Ajustes no está en la hoja. Se abre en un panel que sale por la
// derecha, con la hoja detrás, al pinchar «Ajustes» en el menú; se cierra con
// la X, con Esc o pinchando fuera. Lo de dentro se monta la primera vez que se
// abre y luego se queda (cerrar no pierde lo que se estaba mirando).
// =============================================================================

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function PanelAjustes({
  abierto,
  onCerrar,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const [montado, setMontado] = useState(abierto);
  const panel = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    if (abierto) setMontado(true);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const volver = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar.current();
        return;
      }
      // El foco no se escapa a la hoja de detrás mientras el panel está abierto.
      if (e.key !== 'Tab' || !panel.current) return;
      const enfocables = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.offsetParent !== null);
      if (enfocables.length === 0) return;
      const primero = enfocables[0]!;
      const ultimo = enfocables[enfocables.length - 1]!;
      const actual = document.activeElement;
      if (e.shiftKey && (actual === primero || actual === panel.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && actual === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);

    // La hoja de detrás no se mueve mientras tanto.
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', alTeclear);
      html.style.overflow = antes;
      volver?.focus();
    };
  }, [abierto]);

  if (!montado) return null;

  return (
    <div className={cx('fixed inset-0 z-50', !abierto && 'hidden')}>
      <div className="panel-fondo absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onCerrar} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-ajustes-titulo"
        tabIndex={-1}
        className="panel-ajustes absolute inset-y-0 right-0 flex w-[min(36rem,100%)] flex-col outline-none"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <h2 id="panel-ajustes-titulo" className="flex items-center gap-2 text-lg font-black text-primary">
            <Settings2 size={18} className="text-btc" aria-hidden="true" />
            Ajustes
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar los ajustes"
            title="Cerrar (Esc)"
            className="liquid-action inline-flex h-10 w-10 items-center justify-center rounded-full text-secondary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-90" aria-hidden="true" />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}
