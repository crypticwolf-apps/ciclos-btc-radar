import { useEffect, useRef, useState } from 'react';
import { ChartNoAxesCombined, House, Repeat2, Settings2, Thermometer, type LucideIcon } from 'lucide-react';
import type { PrimaryView } from '@/types';
import { cx } from '@/lib/format';

interface NavItem {
  id: PrimaryView;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inicio', label: 'Inicio', icon: House },
  { id: 'ciclos', label: 'Ciclos', icon: Repeat2 },
  { id: 'temperatura', label: 'Temperatura', icon: Thermometer },
  { id: 'analisis', label: 'Análisis', icon: ChartNoAxesCombined },
  { id: 'ajustes', label: 'Ajustes', icon: Settings2 },
];

interface NavigationProps {
  active: PrimaryView;
  onChange: (id: PrimaryView) => void;
}

/**
 * El menú del móvil: abajo, fijo, con icono y nombre. En escritorio no se ve:
 * allí las pestañas van dentro de la barra superior (`NavegacionBarra`).
 */
export function Navigation({ active, onChange }: NavigationProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="glass-strong liquid-nav fixed inset-x-2 z-50 rounded-[22px] p-1.5 lg:hidden"
    >
      <div className="grid grid-cols-5 gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={selected ? 'page' : undefined}
              className={cx(
                'nav-pill flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[9px] font-semibold transition-colors min-[360px]:text-[10px] lg:min-h-11 lg:flex-row lg:gap-2 lg:px-3 lg:text-sm',
                selected ? 'nav-pill-active text-white' : 'text-muted hover:text-secondary',
              )}
            >
              <Icon size={18} strokeWidth={selected ? 2.5 : 2} aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * El menú en la barra superior, solo en escritorio: una fila compacta de
 * píldoras. Allí no hay pestañas: todo va en una hoja y cada botón baja a su
 * zona (`NavegacionEscritorio`); Ajustes abre su panel.
 */
export function NavegacionBarra({
  active,
  onChange,
  panelAbierto,
}: NavigationProps & {
  /** El panel de Ajustes está abierto (su botón lo dice a los lectores de pantalla). */
  panelAbierto?: boolean;
}) {
  return (
    <nav aria-label="Navegación principal" className="liquid-control hidden items-center gap-0.5 rounded-full p-1 lg:flex">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const selected = active === item.id;
        const panel = item.id === 'ajustes' && panelAbierto != null;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={selected && !panel ? 'page' : undefined}
            aria-haspopup={panel ? 'dialog' : undefined}
            aria-expanded={panel ? panelAbierto : undefined}
            className={cx(
              'nav-pill flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors xl:px-4',
              selected ? 'nav-pill-active text-white' : 'text-muted hover:text-secondary',
            )}
          >
            <Icon size={16} strokeWidth={selected ? 2.5 : 2} aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

/** Las zonas de la hoja de escritorio, en su orden (views/HojaEscritorio). */
const ZONAS: PrimaryView[] = ['inicio', 'ciclos', 'temperatura', 'analisis'];
/** Por debajo de la barra superior: la zona cuyo título ha pasado esta línea es la que se ve. */
const LINEA = 140;

/**
 * El menú de escritorio: cada botón baja deslizando a su zona y el de la zona
 * que se está viendo se marca solo al bajar. «Ajustes» abre su panel.
 */
export function NavegacionEscritorio({ panelAbierto, onAjustes }: { panelAbierto: boolean; onAjustes: () => void }) {
  const [activa, setActiva] = useState<PrimaryView>('inicio');
  // Mientras desliza hacia una zona, se marca ya la de destino (y no las que cruza).
  const destino = useRef<{ zona: PrimaryView; hasta: number } | null>(null);

  useEffect(() => {
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      if (destino.current && Date.now() < destino.current.hasta) return;
      destino.current = null;
      let actual: PrimaryView = 'inicio';
      for (const zona of ZONAS) {
        const el = document.getElementById(`zona-${zona}`);
        if (el && el.getBoundingClientRect().top <= LINEA) actual = zona;
      }
      // Al fondo de la hoja, la última zona aunque su título no llegue arriba.
      const raiz = document.documentElement;
      if (raiz.scrollTop > 0 && window.innerHeight + raiz.scrollTop >= raiz.scrollHeight - 2) {
        actual = [...ZONAS].reverse().find((zona) => document.getElementById(`zona-${zona}`)) ?? actual;
      }
      setActiva(actual);
    };
    const alMoverse = () => {
      if (!cuadro) cuadro = requestAnimationFrame(medir);
    };
    const alParar = () => {
      destino.current = null;
      alMoverse();
    };
    window.addEventListener('scroll', alMoverse, { passive: true });
    window.addEventListener('resize', alMoverse);
    window.addEventListener('scrollend', alParar);
    medir();
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('scroll', alMoverse);
      window.removeEventListener('resize', alMoverse);
      window.removeEventListener('scrollend', alParar);
    };
  }, []);

  const ir = (zona: PrimaryView) => {
    if (zona === 'ajustes') return onAjustes();
    setActiva(zona);
    destino.current = { zona, hasta: Date.now() + 1500 };
    deslizarA(zona === 'inicio' ? null : `zona-${zona}`);
    // La dirección se puede copiar y compartir: lleva a la misma zona.
    const url = new URL(window.location.href);
    if (zona === 'inicio') url.searchParams.delete('vista');
    else url.searchParams.set('vista', zona);
    url.searchParams.delete('sub');
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
  };

  return <NavegacionBarra active={panelAbierto ? 'ajustes' : activa} onChange={ir} panelAbierto={panelAbierto} />;
}

/**
 * Baja deslizando hasta un elemento de la hoja (o arriba del todo, con `null`).
 * Si al terminar lo de encima ha crecido (cuadros que acaban de cargar) y lo ha
 * empujado, se recoloca, salvo que el usuario ya se haya movido.
 */
function deslizarA(id: string | null) {
  const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = suave ? 'smooth' : 'auto';
  const colocar = (b: ScrollBehavior) => {
    if (id == null) window.scrollTo({ top: 0, behavior: b });
    else document.getElementById(id)?.scrollIntoView({ behavior: b, block: 'start' });
  };
  colocar(behavior);
  if (id == null) return;

  let movido = false;
  const alMoverse = () => {
    movido = true;
  };
  const EVENTOS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  EVENTOS.forEach((e) => window.addEventListener(e, alMoverse, { passive: true }));
  window.setTimeout(() => {
    EVENTOS.forEach((e) => window.removeEventListener(e, alMoverse));
    const el = document.getElementById(id);
    if (movido || !el) return;
    const margen = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    if (Math.abs(el.getBoundingClientRect().top - margen) > 8) colocar('auto');
  }, 1100);
}
