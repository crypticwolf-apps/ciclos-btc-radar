import type { HalvingCycleInfo } from '@/types';
import { Timer } from 'lucide-react';
import { formatCompact, formatDateEs } from '@/lib/format';
import { InfoTooltip } from './InfoTooltip';

// Cuenta atrás hasta el próximo halving + días desde el último.
interface HalvingCountdownProps {
  info: HalvingCycleInfo;
}

export function HalvingCountdown({ info }: HalvingCountdownProps) {
  const { diasDesdeUltimoHalving, diasHastaProximoHalving, bloquesRestantes, ultimoHalving } = info;
  // Progreso del ciclo de halving (≈1458 días).
  const total = diasDesdeUltimoHalving + diasHastaProximoHalving;
  const pct = total > 0 ? Math.min(100, (diasDesdeUltimoHalving / total) * 100) : 0;

  return (
    <div className="glass rounded-2xl p-5 animate-fade-in">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-btc">
          <Timer size={18} /> Reloj del halving
          <InfoTooltip text="Cada ~4 años la emisión de Bitcoin se reduce a la mitad. El pico de ciclo suele llegar 12-18 meses después." />
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Días desde el halving" value={formatCompact(diasDesdeUltimoHalving)} sub={`${ultimoHalving.year} · ${ultimoHalving.reward}`} />
        <Stat label="Días al próximo (est.)" value={formatCompact(diasHastaProximoHalving)} sub={`~${formatCompact(bloquesRestantes)} bloques`} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{ultimoHalving.year}</span>
          <span>{formatDateEs(info.proximoHalvingEstimado)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-btc to-btc-600 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-center text-xs text-muted">
          {pct.toFixed(0)}% del ciclo de halving recorrido
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <p className="font-mono text-xl font-bold tabular-nums text-btc">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted">{label}</p>
      <p className="mt-0.5 text-[10px] text-muted/80">{sub}</p>
    </div>
  );
}
