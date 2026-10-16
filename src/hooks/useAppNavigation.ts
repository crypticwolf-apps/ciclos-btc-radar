import { useCallback, useEffect, useState } from 'react';
import type { CyclesSubview, PrimaryView } from '@/types';

const PRIMARY_VIEWS = new Set<PrimaryView>(['inicio', 'ciclos', 'temperatura', 'analisis', 'ajustes']);
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
  // La pestaña «Oportunidad» pasó a llamarse «Temperatura».
  else if (rawView === 'oportunidad') view = 'temperatura';
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

/**
 * Lleva a un apartado concreto de la vista (el elemento con ese id) en cuanto
 * aparece: las pestañas se cargan aparte y tardan un momento en dibujarse. Lo de
 * encima (un gráfico que se carga después) puede crecer y empujarlo, así que se
 * recoloca un par de veces, salvo que el usuario ya se haya movido.
 */
export function scrollToAnchor(id: string) {
  let movido = false;
  const alMoverse = () => {
    movido = true;
  };
  const EVENTOS = ['wheel', 'touchstart', 'keydown'] as const;
  EVENTOS.forEach((e) => window.addEventListener(e, alMoverse, { passive: true }));
  const soltar = () => EVENTOS.forEach((e) => window.removeEventListener(e, alMoverse));
  const colocar = () => {
    if (!movido) document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  };
  // Hasta 8 s: la primera vez, la hoja espera a los datos antes de dibujarse.
  const limite = Date.now() + 8000;
  const buscar = () => {
    if (movido) return soltar();
    if (document.getElementById(id)) {
      colocar();
      // En la hoja de escritorio, lo de encima tarda unos segundos en asentarse.
      [400, 1200, 2500].forEach((ms) => window.setTimeout(colocar, ms));
      window.setTimeout(() => {
        colocar();
        soltar();
      }, 4000);
    } else if (Date.now() < limite) window.setTimeout(buscar, 60);
    else soltar();
  };
  buscar();
}

/**
 * Escritorio (todo en una hoja): a qué sitio de la hoja lleva un enlace de las
 * pestañas del móvil, de los que ya se han compartido o de los avisos.
 * `?vista=temperatura`, a su zona; `#fase-actual`, a ese cuadro; `null`, arriba.
 */
export function destinoEscritorio(view: PrimaryView, sub: CyclesSubview, hash: string): string | null {
  if (hash.length > 1) return decodeURIComponent(hash.slice(1));
  if (view === 'ciclos') return sub === 'altseason' ? 'zona-altseason' : sub === 'comparativa' ? 'zona-comparativa' : 'zona-ciclos';
  if (view === 'temperatura' || view === 'analisis') return `zona-${view}`;
  return null;
}

export function useAppNavigation() {
  const initial = readLocation();
  const [location, setLocation] = useState<Location>(initial);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vista = params.get('vista');
    if (params.has('mas') || vista === 'precio' || vista === 'mas' || vista === 'oportunidad') {
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

  /** Cambia de pestaña; con `ancla`, va directo a ese apartado (el id de su tarjeta). */
  const goTo = useCallback((nextView: PrimaryView, sub: CyclesSubview = 'bitcoin', ancla?: string) => {
    const next: Location = { view: nextView, sub };
    setLocation(next);
    writeLocation(next);
    if (ancla) scrollToAnchor(ancla);
    else resetMainScroll();
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
