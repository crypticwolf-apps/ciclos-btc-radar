import { useCallback, useEffect, useState } from 'react';
import type { PrimaryView } from '@/types';

const PRIMARY_VIEWS = new Set<PrimaryView>(['inicio', 'ciclos', 'oportunidad', 'analisis', 'ajustes']);

function readLocation(): PrimaryView {
  if (typeof window === 'undefined') return 'inicio';
  const params = new URLSearchParams(window.location.search);
  const rawView = params.get('vista');

  // Compatibilidad con enlaces compartidos antes de la reorganización.
  if (rawView === 'precio') return 'inicio';
  if (rawView === 'mas') {
    const oldMore = params.get('mas');
    return oldMore === 'ajustes' || oldMore === 'legal' ? 'ajustes' : 'analisis';
  }

  return rawView && PRIMARY_VIEWS.has(rawView as PrimaryView) ? (rawView as PrimaryView) : 'inicio';
}

function writeLocation(view: PrimaryView, replace = false) {
  const url = new URL(window.location.href);
  if (view === 'inicio') url.searchParams.delete('vista');
  else url.searchParams.set('vista', view);
  url.searchParams.delete('mas');
  window.history[replace ? 'replaceState' : 'pushState']({ view }, '', url);
}

function resetMainScroll() {
  window.requestAnimationFrame(() => {
    document.getElementById('view-content')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
}

export function useAppNavigation() {
  const initial = readLocation();
  const [view, setView] = useState<PrimaryView>(initial);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('mas') || params.get('vista') === 'precio' || params.get('vista') === 'mas') {
      writeLocation(initial, true);
    }

    const handlePopState = () => {
      const next = readLocation();
      setView(next);
      resetMainScroll();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const goTo = useCallback((nextView: PrimaryView) => {
    setView(nextView);
    writeLocation(nextView);
    resetMainScroll();
  }, []);

  return { view, goTo };
}

