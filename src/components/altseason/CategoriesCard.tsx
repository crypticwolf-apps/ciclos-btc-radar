import { memo, useMemo, useState } from 'react';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { SegmentedControl } from '@/components/ui/Controls';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { useCategories } from '@/hooks/useCategories';
import { useEnVista } from '@/hooks/useEnVista';
import { useLivePrices } from '@/hooks/useRealtime';
import { categorySymbols, MIN_CON_DATO, rankCategories, type PeriodoVista } from '@/lib/altseason/categories';
import { cx, formatPercent } from '@/lib/format';
import { dec } from '@/lib/numberEs';

// =============================================================================
// Ciclos → Altseason → «Categorías en cabeza»: qué familia de altcoins (L1, L2,
// IA, RWA, DeFi, DePIN, memes…) se está moviendo mejor, en vivo.
//
// Cada categoría se resume con la MEDIANA de sus monedas (las 20 mayores de
// cada lista de CoinGecko) y se compara con lo que hizo Bitcoin en el mismo
// periodo. Cómo se calcula, en src/lib/altseason/categories.ts y en el
// proveedor api/_lib/providers/categories.ts.
// =============================================================================

const PERIODOS: { value: PeriodoVista; label: string }[] = [
  { value: 'd1', label: '24 h' },
  { value: 'd7', label: '7 d' },
  { value: 'd30', label: '30 d' },
  { value: 'd90', label: '90 d' },
  { value: 'y1', label: '1 año' },
  { value: 'ath', label: 'Máx' },
];

const NOMBRE_PERIODO: Record<PeriodoVista, string> = {
  d1: 'en 24 horas',
  d7: 'en 7 días',
  d30: 'en 30 días',
  d90: 'en 90 días',
  y1: 'en un año',
  ath: 'desde su máximo histórico',
};

const EXCHANGE: Record<string, string> = { binance: 'Binance', okx: 'OKX', bybit: 'Bybit' };

// `memo`: lleva su propio sondeo de precios; no tiene que redibujarse cuando
// lo hace el resto de la pantalla de Altseason.
export const CategoriesCard = memo(function CategoriesCard() {
  const [periodo, setPeriodo] = useState<PeriodoVista>('d7');
  const q = useCategories();
  const data = q.data?.data ?? null;

  // Precios en vivo solo mientras la ficha está a la vista.
  const [ref, enVista] = useEnVista<HTMLDivElement>();
  const symbols = useMemo(() => (data ? categorySymbols(data) : []), [data]);
  const live = useLivePrices(symbols, enVista && data != null, data?.exchange ?? undefined);
  const enVivo = live.data != null && !live.stale;

  const { filas, btc } = useMemo(
    () => (data ? rankCategories(data, live.data?.prices, periodo) : { filas: [], btc: null }),
    [data, live.data, periodo],
  );
  const conDato = filas.filter((f) => f.mediana != null);
  const lider = conDato[0] ?? null;
  const escala = Math.max(1, ...conDato.map((f) => Math.abs(f.mediana!)));
  const ath = periodo === 'ath';

  return (
    <CollapsibleCard
      title="Categorías en cabeza"
      titleClassName="text-primary"
      subtitle="Qué familia de altcoins predomina, en vivo"
      info="Para cada categoría, la mediana de sus 20 mayores monedas (listas de CoinGecko) y la diferencia con Bitcoin en el mismo periodo. La mediana evita que un solo meme disparado mueva la categoría entera. 24 h, 7 d, 30 d y 1 año: CoinGecko; 90 d: velas de exchange de las 100 altcoins del análisis (las que no están en él quedan sin dato); Máx: distancia a su máximo histórico, porque el rendimiento desde que salió cada moneda no lo publica ninguna API gratuita. Todo se mueve en vivo con el precio al contado."
      badge={
        live.data ? (
          <FreshnessTag
            freshness={enVivo ? 'actualizado' : 'cache'}
            at={live.data.at}
            source={`${EXCHANGE[live.data.source] ?? live.data.source} · precio al contado cada 5 s`}
          />
        ) : undefined
      }
    >
      <div ref={ref} className="space-y-3">
        <SegmentedControl<PeriodoVista> size="sm" value={periodo} onChange={setPeriodo} options={PERIODOS} />

        {q.isLoading ? (
          <Skeleton className="h-72" />
        ) : !data || conDato.length === 0 ? (
          <p className="liquid-subcard rounded-2xl px-4 py-6 text-center text-sm text-muted">
            {data ? 'No hay datos suficientes para este periodo.' : 'Las categorías no están disponibles ahora mismo. Vuelven solas en cuanto responda la fuente.'}
          </p>
        ) : (
          <>
            <p className="liquid-subcard rounded-xl px-3 py-2.5 text-xs leading-relaxed text-secondary">
              {lider && btc != null && lider.mediana! <= btc && !ath ? (
                <>Ninguna categoría bate a Bitcoin {NOMBRE_PERIODO[periodo]}: lo hace mejor la propia BTC ({formatPercent(btc)}).</>
              ) : lider ? (
                <>
                  {ath ? 'Más cerca de sus máximos: ' : 'Predomina '}
                  <strong className="text-primary">{lider.nombre}</strong>, con una mediana de{' '}
                  <strong className={cx(lider.mediana! >= 0 ? 'text-bull' : 'text-bear')}>{formatPercent(lider.mediana)}</strong>{' '}
                  {NOMBRE_PERIODO[periodo]}
                  {lider.batenBtc != null && !ath && <>; {lider.batenBtc}% de sus monedas bate a Bitcoin</>}.
                </>
              ) : null}
              {btc != null && (
                <span className="mt-1 block text-[11px] text-muted">
                  Bitcoin, como referencia: {formatPercent(btc)} {NOMBRE_PERIODO[periodo]}.
                </span>
              )}
            </p>

            <ul className="space-y-1.5">
              {filas.map((f, i) => {
                const v = f.mediana;
                const ancho = v == null ? 0 : Math.max(2, (Math.abs(v) / escala) * 50);
                return (
                  <li key={f.id} className="liquid-subcard rounded-xl px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-primary">
                        <span className="mr-1.5 text-[11px] text-muted">{v == null ? '·' : i + 1}</span>
                        {f.nombre}
                      </span>
                      <span className={cx('shrink-0 font-mono text-sm font-bold', v == null ? 'text-muted' : v >= 0 ? 'text-bull' : 'text-bear')}>
                        {formatPercent(v)}
                      </span>
                    </div>
                    {/* Barra con el cero en el centro: a la derecha sube, a la izquierda baja. */}
                    <div className="relative mt-1.5 h-1.5 rounded-full" style={{ background: 'var(--grid-line)' }} aria-hidden="true">
                      <span className="absolute left-1/2 top-[-2px] h-[10px] w-px" style={{ background: 'var(--text-muted)' }} />
                      {v != null && (
                        <span
                          className={cx('absolute top-0 h-full rounded-full', v >= 0 ? 'bg-bull' : 'bg-bear')}
                          style={v >= 0 ? { left: '50%', width: `${ancho}%` } : { right: '50%', width: `${ancho}%` }}
                        />
                      )}
                    </div>
                    <p className="mt-1 text-[10px] leading-tight text-muted">
                      {v == null ? (
                        `Menos de ${MIN_CON_DATO} monedas con dato en este periodo`
                      ) : (
                        <>
                          {f.vsBtc != null && !ath && (
                            <span className={f.vsBtc >= 0 ? 'text-bull' : 'text-bear'}>
                              {f.vsBtc >= 0 ? '+' : '−'}
                              {dec(Math.abs(f.vsBtc), 1)} pp vs BTC ·{' '}
                            </span>
                          )}
                          {f.mejor && (
                            <>
                              {ath ? 'más cerca: ' : 'mejor: '}
                              {f.mejor.symbol} {formatPercent(f.mejor.valor)} ·{' '}
                            </>
                          )}
                          {f.conDato} de {f.total} con dato
                          {f.lista === 'respaldo' && ' · lista propia'}
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>

            <p className="text-[11px] leading-relaxed text-muted">
              {ath
                ? 'Máx: mediana de la distancia de cada moneda a su máximo histórico (0% = en máximos). El rendimiento desde que salió cada moneda no lo publica ninguna API gratuita.'
                : 'Mediana de las 20 mayores monedas de cada categoría (CoinGecko), en vivo con el precio al contado.'}
            </p>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
});
