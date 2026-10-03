import { useMemo } from 'react';
import { useAltseason } from './useAltseason';
import { useLivePrices } from './useRealtime';
import { liveAltseason } from '@/lib/altseason/live';

/**
 * Altseason con los precios en vivo: el cálculo completo del servidor (cada
 * 30 min) más el precio al contado de BTC, ETH y todo el ranking cada 5 s, con
 * el que se rehacen el ranking, la amplitud, ETH/BTC y el score.
 *
 * `live` en falso no pide precios: el marcador de inicio solo los pide
 * mientras está a la vista.
 */
export function useLiveAltseason(live = true) {
  const query = useAltseason();
  const base = query.data?.data ?? null;
  const symbols = useMemo(
    () => (base ? ['BTC', 'ETH', ...base.ranking.map((r) => r.symbol)] : []),
    [base],
  );
  const prices = useLivePrices(symbols, live && base != null, base?.exchange);
  const data = useMemo(
    () => (base ? liveAltseason(base, prices.data?.prices) : null),
    [base, prices.data],
  );
  return { query, data, prices, enVivo: prices.data != null && !prices.stale };
}
