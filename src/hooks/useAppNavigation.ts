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
 * encima puede seguir cambiando de alto unos segundos (cuadros que se montan,
 * gráficos que cargan, columnas de escritorio que se cuadran) y empujarlo, así
 * que se vigila dónde queda y se recoloca cada vez que se mueve. Se suelta en
 * cuanto el usuario toca la página, tras unos segundos sin que nada lo mueva o,
 * como mucho, a los 15 s. Antes se recolocaba solo durante 4 s, y en la hoja de
 * escritorio el destino acababa medio pantallazo más abajo.
 */
export function scrollToAnchor(id: string) {
  let movido = false;
  const alMoverse = () => {
    movido = true;
  };
  const EVENTOS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  EVENTOS.forEach((e) => window.addEventListener(e, alMoverse, { passive: true }));
  const soltar = () => EVENTOS.forEach((e) => window.removeEventListener(e, alMoverse));
  // Sin animación: con `auto` manda el `scroll-behavior: smooth` de la página,
  // la posición que se medía justo después era la de salida y el vigilante,
  // creyendo que el destino se había movido, lo recolocaba cada 150 ms durante
  // 15 s.
  const colocar = () => {
    if (!movido) document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  };
  // Hasta 8 s para aparecer: la primera vez, la hoja espera a los datos.
  const limite = Date.now() + 8000;
  const buscar = () => {
    if (movido) return soltar();
    const el = document.getElementById(id);
    if (!el) {
      if (Date.now() < limite) window.setTimeout(buscar, 60);
      else soltar();
      return;
    }
    colocar();
    const objetivo = el.getBoundingClientRect().top;
    const hasta = Date.now() + 15_000;
    let quietoDesde = Date.now();
    const vigilar = () => {
      const actual = document.getElementById(id);
      if (movido || !actual || Date.now() > hasta) return soltar();
      if (Math.abs(actual.getBoundingClientRect().top - objetivo) > 2) {
        colocar();
        quietoDesde = Date.now();
      } else if (Date.now() - quietoDesde > 4000) {
        return soltar();
      }
      window.setTimeout(vigilar, 150);
    };
    window.setTimeout(vigilar, 150);
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
