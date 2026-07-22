import { useCallback, useEffect, useState } from 'react';
import type { MoreView, PrimaryView } from '@/types';

const PRIMARY_VIEWS = new Set<PrimaryView>(['inicio', 'precio', 'ciclos', 'oportunidad', 'mas']);
const MORE_VIEWS = new Set<MoreView>([
  'menu',
  'caidas',
  'suelo',
  'smart-money',
  'rsi',
  'onchain',
  'macro',
  'ajustes',
  'legal',
]);

function readLocation(): { view: PrimaryView; more: MoreView } {
  if (typeof window === 'undefined') return { view: 'inicio', more: 'menu' };
  const params = new URLSearchParams(window.location.search);
  const rawView = params.get('vista') as PrimaryView | null;
  const view = rawView && PRIMARY_VIEWS.has(rawView) ? rawView : 'inicio';
  const rawMore = params.get('mas') as MoreView | null;
  const more = view === 'mas' && rawMore && MORE_VIEWS.has(rawMore) ? rawMore : 'menu';
  return { view, more };
}

function writeLocation(view: PrimaryView, more: MoreView, replace = false) {
  const url = new URL(window.location.href);
  if (view === 'inicio') url.searchParams.delete('vista');
  else url.searchParams.set('vista', view);
  if (view === 'mas' && more !== 'menu') url.searchParams.set('mas', more);
  else url.searchParams.delete('mas');
  window.history[replace ? 'replaceState' : 'pushState']({ view, more }, '', url);
}

function resetMainScroll() {
  window.requestAnimationFrame(() => {
    document.getElementById('view-content')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
}

export function useAppNavigation() {
  const initial = readLocation();
  const [view, setView] = useState<PrimaryView>(initial.view);
  const [more, setMore] = useState<MoreView>(initial.more);

  useEffect(() => {
    const handlePopState = () => {
      const next = readLocation();
      setView(next.view);
      setMore(next.more);
      resetMainScroll();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const goTo = useCallback((nextView: PrimaryView) => {
    const nextMore: MoreView = nextView === 'mas' ? 'menu' : 'menu';
    setView(nextView);
    setMore(nextMore);
    writeLocation(nextView, nextMore);
    resetMainScroll();
  }, []);

  const openMore = useCallback((nextMore: MoreView) => {
    setView('mas');
    setMore(nextMore);
    writeLocation('mas', nextMore);
    resetMainScroll();
  }, []);

  return { view, more, goTo, openMore };
}
