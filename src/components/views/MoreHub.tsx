import {
  Activity,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  FileWarning,
  Link2,
  Settings2,
  Target,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import type { MoreView } from '@/types';
import { Card } from '@/components/ui/Card';

const ITEMS: Array<{ id: Exclude<MoreView, 'menu'>; title: string; description: string; icon: LucideIcon }> = [
  { id: 'caidas', title: 'CaÃ­das', description: 'Drawdowns y recuperaciones', icon: TrendingDown },
  { id: 'suelo', title: 'Suelo', description: 'MÃ­nimos histÃ³ricos ascendentes', icon: ChartNoAxesCombined },
  { id: 'smart-money', title: 'Smart money', description: 'Ballenas y manos fuertes', icon: Activity },
  { id: 'rsi', title: 'RSI y miedo', description: 'Momentum y sentimiento', icon: Target },
  { id: 'onchain', title: 'On-chain', description: 'Red, bloques y actividad', icon: Link2 },
  { id: 'macro', title: 'Macro', description: 'Ciclo econÃ³mico y liquidez', icon: Building2 },
  { id: 'ajustes', title: 'Ajustes', description: 'Tema y actualizaciÃ³n manual', icon: Settings2 },
  { id: 'legal', title: 'Aviso legal', description: 'Riesgos y uso educativo', icon: FileWarning },
];

export function MoreHub({ onOpen }: { onOpen: (view: MoreView) => void }) {
  return (
    <Card className="!p-3 sm:!p-5">
      <div className="px-1 pb-3">
        <h1 className="text-xl font-extrabold text-primary">MÃ¡s anÃ¡lisis</h1>
        <p className="mt-1 text-sm text-muted">Abre un indicador sin acumular contenido en la pantalla.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className="liquid-action flex min-h-[68px] min-w-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-btc/10 text-btc">
                <Icon size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-primary">{item.title}</span>
                <span className="block truncate text-xs text-muted">{item.description}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-muted" />
            </button>
          );
        })}
      </div>
      <p className="px-2 pt-4 text-center text-[11px] text-muted">Ciclos BTC Â· informaciÃ³n educativa</p>
    </Card>
  );
}
