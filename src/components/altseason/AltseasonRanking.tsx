import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/Controls';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { AltcoinRow } from '@/types/altseason';
import { cx, formatPercent } from '@/lib/format';

// =============================================================================
// Ranking de altcoins.
//
// En móvil son TARJETAS (nunca una tabla con scroll horizontal) y en escritorio
// una tabla normal. Se muestran pocas de entrada y hay un botón «Ver más»: así
// la vista no se hace interminable ni necesita contenedores con scroll propio.
// =============================================================================

type SortKey = 'marketCap' | 'change7d' | 'change30d' | 'change90d' | 'vsBtc';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'marketCap', label: 'Cap.' },
  { value: 'change7d', label: '7 d' },
  { value: 'change30d', label: '30 d' },
  { value: 'change90d', label: '90 d' },
  { value: 'vsBtc', label: 'vs BTC' },
];

const INITIAL = 10;

/** Etiqueta de fortaleza a partir de las medias móviles y el resultado vs BTC. */
function strength(row: AltcoinRow): { label: string; tone: string } {
  const above = [row.aboveSma20, row.aboveSma50, row.aboveSma200].filter(Boolean).length;
  if (row.beatsBtc && above >= 2) return { label: 'Fuerte', tone: 'text-bull' };
  if (row.beatsBtc) return { label: 'Mejorando', tone: 'text-btc' };
  if (above === 0) return { label: 'Débil', tone: 'text-bear' };
  return { label: 'Neutral', tone: 'text-muted' };
}

export function AltseasonRanking({ rows }: { rows: AltcoinRow[] }) {
  const { formatFromUsd, formatCompactFromUsd } = useCurrency();
  const [sort, setSort] = useState<SortKey>('marketCap');
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const val = (r: AltcoinRow): number => {
      switch (sort) {
        case 'change7d':
          return r.change7d ?? -Infinity;
        case 'change30d':
          return r.change30d ?? -Infinity;
        case 'change90d':
          return r.change90d ?? -Infinity;
        case 'vsBtc':
          return r.vsBtc90d ?? -Infinity;
        default:
          return r.marketCapUsd;
      }
    };
    return [...rows].sort((a, b) => val(b) - val(a));
  }, [rows, sort]);

  const visible = showAll ? sorted : sorted.slice(0, INITIAL);

  return (
    <Card className="!p-4 sm:!p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-primary sm:text-lg">
          Ranking de altcoins
          <span className="ml-2 text-xs font-normal text-muted">{rows.length} analizadas</span>
        </h2>
      </div>

      <div className="mb-3">
        <p className="mb-1.5 text-[11px] text-muted">Ordenar por</p>
        <SegmentedControl<SortKey>
          size="sm"
          value={sort}
          onChange={setSort}
          options={SORTS}
          className="w-full [&>button]:flex-1"
        />
      </div>

      {/* Móvil y tablet: tarjetas */}
      <ul className="space-y-2 lg:hidden">
        {visible.map((r, i) => {
          const s = strength(r);
          return (
            <li key={r.symbol} className="liquid-subcard rounded-xl p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="shrink-0 font-mono text-[10px] text-muted">
                    {sorted.indexOf(r) + 1}
                  </span>
                  <span className="truncate text-sm font-bold text-primary">{r.symbol}</span>
                  <span className="truncate text-[11px] text-muted">{r.name}</span>
                </span>
                <span className={cx('shrink-0 text-[10px] font-semibold', s.tone)}>{s.label}</span>
              </div>

              <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                <Cell label="Precio" value={formatFromUsd(r.priceUsd)} />
                <Cell label="7 d" value={r.change7d} pct />
                <Cell label="30 d" value={r.change30d} pct />
                <Cell label="90 d" value={r.change90d} pct />
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted">
                <span className="truncate">Cap. {formatCompactFromUsd(r.marketCapUsd)}</span>
                <span
                  className={cx(
                    'shrink-0 font-mono font-bold',
                    (r.vsBtc90d ?? 0) >= 0 ? 'text-bull' : 'text-bear',
                  )}
                >
                  {r.vsBtc90d == null ? '—' : `${formatPercent(r.vsBtc90d)} vs BTC`}
                </span>
              </div>
              {i === 0 && null}
            </li>
          );
        })}
      </ul>

      {/* Escritorio: tabla */}
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">
            Ranking de altcoins por capitalización y rendimiento frente a Bitcoin
          </caption>
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-muted">
              <th scope="col" className="w-[6%] py-2">#</th>
              <th scope="col" className="w-[22%] py-2">Activo</th>
              <th scope="col" className="w-[14%] py-2 text-right">Precio</th>
              <th scope="col" className="w-[13%] py-2 text-right">Cap.</th>
              <th scope="col" className="w-[10%] py-2 text-right">7 d</th>
              <th scope="col" className="w-[10%] py-2 text-right">30 d</th>
              <th scope="col" className="w-[10%] py-2 text-right">90 d</th>
              <th scope="col" className="w-[10%] py-2 text-right">vs BTC</th>
              <th scope="col" className="w-[10%] py-2 text-right">Fuerza</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const s = strength(r);
              return (
                <tr key={r.symbol} className="border-b border-white/5">
                  <td className="py-2.5 font-mono text-xs text-muted">{sorted.indexOf(r) + 1}</td>
                  <th scope="row" className="py-2.5 text-left font-medium text-primary">
                    {r.symbol}
                    <span className="block truncate text-[10px] font-normal text-muted">
                      {r.name}
                    </span>
                  </th>
                  <td className="py-2.5 text-right font-mono text-secondary">
                    {formatFromUsd(r.priceUsd)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs text-muted">
                    {formatCompactFromUsd(r.marketCapUsd)}
                  </td>
                  <Td value={r.change7d} />
                  <Td value={r.change30d} />
                  <Td value={r.change90d} />
                  <Td value={r.vsBtc90d} bold />
                  <td className={cx('py-2.5 text-right text-xs font-semibold', s.tone)}>
                    {s.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > INITIAL && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="liquid-action mt-3 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-secondary"
        >
          {showAll ? 'Ver menos' : `Ver las ${sorted.length} altcoins`}
        </button>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        No se incluyen stablecoins ni versiones envueltas o en staking de otro activo. «vs BTC» es
        la diferencia de rendimiento a 90 días frente a Bitcoin, en puntos porcentuales.
      </p>
    </Card>
  );
}

function Cell({ label, value, pct }: { label: string; value: string | number | null; pct?: boolean }) {
  const num = typeof value === 'number' ? value : null;
  return (
    <span className="min-w-0">
      <span className="block text-[9px] leading-tight text-muted">{label}</span>
      <span
        className={cx(
          'block truncate font-mono text-[11px] font-bold',
          pct && num != null ? (num >= 0 ? 'text-bull' : 'text-bear') : 'text-secondary',
        )}
      >
        {value == null ? '—' : pct && num != null ? formatPercent(num) : String(value)}
      </span>
    </span>
  );
}

function Td({ value, bold }: { value: number | null; bold?: boolean }) {
  return (
    <td
      className={cx(
        'py-2.5 text-right font-mono text-xs',
        value == null ? 'text-muted' : value >= 0 ? 'text-bull' : 'text-bear',
        bold && 'font-bold',
      )}
    >
      {value == null ? '—' : formatPercent(value)}
    </td>
  );
}
