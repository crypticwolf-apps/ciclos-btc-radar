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
      className="glass-strong liquid-nav fixed inset-x-2 z-50 rounded-[22px] p-1.5 sm:sticky sm:inset-x-auto sm:top-[65px] sm:z-30 sm:mx-0"
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
                'nav-pill flex min-h-[58px] min-w-[64px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-semibold transition-colors sm:min-h-11 sm:min-w-0 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm',
                selected ? 'nav-pill-active text-white' : 'text-muted hover:text-secondary',
              )}
            >
              <Icon size={18} strokeWidth={selected ? 2.5 : 2} />
              <span>{item.shortName}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { NAV_ITEMS };
