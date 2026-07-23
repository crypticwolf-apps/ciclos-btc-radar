import { useCallback, useEffect, useState } from 'react';
import type { CyclesSubview, PrimaryView } from '@/types';

const PRIMARY_VIEWS = new Set<PrimaryView>(['inicio', 'ciclos', 'oportunidad', 'analisis', 'ajustes']);
const CYCLES_SUBVIEWS = new Set<CyclesSubview>(['bitcoin', 'altseason', 'comparativa']);

interface Location {
  view: PrimaryView;
  /** Subapartado dentro de Ciclos. Solo aplica cuando view === 'ciclos'. */
  sub: CyclesSubview;
}

function readLocation(): Location {
  if (typeof window === 'undefined') return { view: 'inicio', sub: 'bitcoin' };
  const params = new URLSearchParams(window.location.search);
  const rawView = params.get('vista');
  const rawSub = params.get('sub');

  // Compatibilidad con enlaces compartidos antes de la reorganización.
  let view: PrimaryView = 'inicio';
  if (rawView === 'precio') view = 'inicio';
  else if (rawView === 'mas') {
    const oldMore = params.get('mas');
    view = oldMore === 'ajustes' || oldMore === 'legal' ? 'ajustes' : 'analisis';
  } else if (rawView && PRIMARY_VIEWS.has(rawView as PrimaryView)) {
    view = rawView as PrimaryView;
  }

  const sub =
    rawSub && CYCLES_SUBVIEWS.has(rawSub as CyclesSubview) ? (rawSub as CyclesSubview) : 'bitcoin';

  return { view, sub };
}

function writeLocation(loc: Location, replace = false) {
  const url = new URL(window.location.href);
  if (loc.view === 'inicio') url.searchParams.delete('vista');
  else url.searchParams.set('vista', loc.view);

  // El subapartado solo tiene sentido dentro de Ciclos, y 'bitcoin' es el
  // predeterminado: así no ensucia la URL.
  if (loc.view === 'ciclos' && loc.sub !== 'bitcoin') url.searchParams.set('sub', loc.sub);
  else url.searchParams.delete('sub');

  url.searchParams.delete('mas');
  window.history[replace ? 'replaceState' : 'pushState']({ ...loc }, '', url);
}

function resetMainScroll() {
  window.requestAnimationFrame(() => {
    document.getElementById('view-content')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
}

export function useAppNavigation() {
  const initial = readLocation();
  const [location, setLocation] = useState<Location>(initial);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('mas') || params.get('vista') === 'precio' || params.get('vista') === 'mas') {
      writeLocation(initial, true);
    }

    // El botón atrás del navegador debe recorrer también los subapartados.
    const handlePopState = () => {
      setLocation(readLocation());
      resetMainScroll();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback((nextView: PrimaryView, sub: CyclesSubview = 'bitcoin') => {
    const next: Location = { view: nextView, sub };
    setLocation(next);
    writeLocation(next);
    resetMainScroll();
  }, []);

  /** Cambia de subapartado dentro de Ciclos sin salir de la pestaña. */
  const goToSub = useCallback((sub: CyclesSubview) => {
    const next: Location = { view: 'ciclos', sub };
    setLocation(next);
    writeLocation(next);
    resetMainScroll();
  }, []);

  return { view: location.view, sub: location.sub, goTo, goToSub };
}
