import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/format';
import { InfoTooltip } from './InfoTooltip';

type Tone = 'btc' | 'bull' | 'bear' | 'macro' | 'neutral';

const TONE_TEXT: Record<Tone, string> = {
  btc: 'text-btc',
  bull: 'text-bull',
  bear: 'text-bear',
  macro: 'text-macro',
  neutral: 'text-secondary',
};

const TONE_BG: Record<Tone, string> = {
  btc: 'bg-btc/10 border-btc/25',
  bull: 'bg-bull/10 border-bull/25',
  bear: 'bg-bear/10 border-bear/25',
  macro: 'bg-macro/10 border-macro/25',
  neutral: 'bg-white/5 border-white/10',
};

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon?: LucideIcon;
  info?: string;
  pulse?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  sub,
  tone = 'neutral',
  icon: Icon,
  info,
  pulse,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cx(
        // Compacta a propósito: van de cuatro en cuatro y antes cada una
        // ocupaba una fila entera del móvil, así que cuatro cifras sueltas
        // se comían dos pantallas de scroll.
        'liquid-subcard rounded-xl border p-2.5 animate-fade-in sm:rounded-2xl sm:p-3.5',
        TONE_BG[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium leading-tight text-muted sm:text-xs">
          {/* `min-w-0` en el texto y no en la fila: si se encoge la fila
              entera, el icono de ayuda se desliza por debajo del de la derecha
              y deja de poder pulsarse. */}
          <span className="min-w-0 break-words">{label}</span>
          {info && <InfoTooltip text={info} />}
        </span>
        {Icon && <Icon size={15} className={cx('shrink-0', TONE_TEXT[tone])} />}
      </div>
      <p
        className={cx(
          // Tamaño elástico: en una rejilla de tres a 320 px, «56.304 €» a
          // 18 px se salía de su cuadro. Encoge con la pantalla en vez de
          // desbordarse, y arriba se queda en 20 px.
          'mt-1 font-mono text-[clamp(0.8rem,3.4vw,1.25rem)] font-bold leading-none tabular-nums animate-count-up',
          TONE_TEXT[tone],
          pulse && 'animate-pulse',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] leading-tight text-muted sm:text-xs">{sub}</p>}
    </div>
  );
}
