import {
  Activity,
  ChartNoAxesCombined,
  Factory,
  HeartPulse,
  Link2,
  Repeat2,
  Sparkles,
  Target,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import type { SectionId } from '@/types';
import { cx } from '@/lib/format';

interface NavItem {
  id: SectionId;
  name: string;
  shortName: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'ciclos', name: 'Ciclos', shortName: 'Ciclos', icon: Repeat2 },
  { id: 'caidas', name: 'Caídas y recuperaciones', shortName: 'Caídas', icon: TrendingDown },
  { id: 'suelo', name: 'Suelo ascendente', shortName: 'Suelo', icon: ChartNoAxesCombined },
  { id: 'smart-money', name: 'Smart money', shortName: 'Ballenas', icon: Activity },
  { id: 'rsi', name: 'RSI y miedo', shortName: 'RSI', icon: Target },
  { id: 'onchain', name: 'On-chain', shortName: 'On-chain', icon: Link2 },
  { id: 'macro', name: 'Ciclo económico', shortName: 'Macro', icon: Factory },
  { id: 'resumen', name: 'Resumen', shortName: 'Resumen', icon: Sparkles },
  { id: 'estado', name: 'Estado de fuentes', shortName: 'Estado', icon: HeartPulse },
];

interface NavigationProps {
  active: SectionId;
  onChange: (id: SectionId) => void;
}

export function Navigation({ active, onChange }: NavigationProps) {
  return (
    <nav
      aria-label="Secciones del análisis"
      className="glass-strong liquid-nav sticky top-[105px] z-30 -mx-1 rounded-2xl p-1.5 sm:top-[65px] sm:mx-0 sm:rounded-[22px]"
    >
      <div className="nav-scroll flex snap-x snap-mandatory gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              aria-current={selected ? 'page' : undefined}
              title={item.name}
              className={cx(
                'nav-pill flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors sm:text-sm',
                selected ? 'nav-pill-active text-white' : 'text-muted hover:text-secondary',
              )}
            >
              <Icon size={16} strokeWidth={selected ? 2.5 : 2} />
              <span>{item.shortName}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { NAV_ITEMS };
