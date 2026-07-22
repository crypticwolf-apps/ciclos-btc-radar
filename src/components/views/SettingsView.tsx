import { Moon, RefreshCw, Sun } from 'lucide-react';
import type { Theme } from '@/types';
import { Card } from '@/components/ui/Card';
import { cx } from '@/lib/format';

export function SettingsView({ theme, onToggleTheme, refreshing, onRefresh }: { theme: Theme; onToggleTheme: () => void; refreshing: boolean; onRefresh: () => void }) {
  return (
    <Card>
      <h2 className="text-lg font-bold text-primary">Ajustes</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onToggleTheme} className="liquid-action flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-secondary">
          {theme === 'dark' ? <Sun size={19} className="text-btc" /> : <Moon size={19} className="text-btc" />}
          Usar tema {theme === 'dark' ? 'claro' : 'oscuro'}
        </button>
        <button type="button" onClick={onRefresh} disabled={refreshing} className="liquid-action flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-secondary disabled:opacity-60">
          <RefreshCw size={19} className={cx('text-btc', refreshing && 'animate-spin')} />
          {refreshing ? 'Actualizando datos…' : 'Actualizar todos los datos'}
        </button>
      </div>
    </Card>
  );
}
