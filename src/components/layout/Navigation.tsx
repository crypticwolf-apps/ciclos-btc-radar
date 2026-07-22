import { ChartNoAxesCombined, Gauge, House, Repeat2, Settings2, type LucideIcon } from 'lucide-react';
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
  { id: 'oportunidad', label: 'Oportunidad', icon: Gauge },
  { id: 'analisis', label: 'Análisis', icon: ChartNoAxesCombined },
  { id: 'ajustes', label: 'Ajustes', icon: Settings2 },
];

interface NavigationProps {
  active: PrimaryView;
  onChange: (id: PrimaryView) => void;
}

export function Navigation({ active, onChange }: NavigationProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="glass-strong liquid-nav fixed inset-x-2 z-50 rounded-[22px] p-1.5 lg:static lg:inset-x-auto lg:z-20 lg:mb-4"
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

