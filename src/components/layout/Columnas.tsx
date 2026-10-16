import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { subscribeCollapsibles } from '@/lib/collapseAll';
import { cx } from '@/lib/format';

// =============================================================================
// Columnas de escritorio: los cuadros repartidos según el ancho del monitor,
// para aprovechar la pantalla y bajar lo mínimo.
//
//   · Móvil y tableta (menos de 1024 px): una columna, exactamente como antes.
//   · Desde 1024 px, dos columnas; desde 1536 px, tres; desde 2400 px, cuatro.
//
// Cada cuadro se coloca en la columna que va más corta según su altura REAL
// (medida), y luego se prueban las combinaciones para que las columnas acaben
// lo más parejas posible. Los cuadros van posicionados dentro de una caja que
// mide lo que la columna más alta: nunca se solapan, porque cada vez que uno
// cambia de alto (carga, se pliega o se despliega) se recalcula dónde empieza
// cada uno de los de debajo, antes de pintar.
//
// La columna de cada cuadro se decide mientras la pantalla se asienta (los
// cuadros se van cargando) y luego se queda FIJA: plegar o desplegar no mueve
// los demás de columna, solo sube o baja los de debajo. Moverlos no los vuelve
// a montar: siguen siendo los mismos elementos, solo cambia su posición.
//
// Un cuadro puede ocupar todo el ancho (`ancho`): corta el reparto, lo de antes
// queda encima y lo de después, debajo. Con `alFinal`, en escritorio va detrás
// de todos (una tabla ancha, por ejemplo), sin cambiar el orden del móvil.
// =============================================================================

export interface ItemColumna {
  clave: string;
  nodo: ReactNode;
  /** Altura aproximada en px, solo hasta que se mide la real. */
  alto?: number;
  /** Ocupa todas las columnas. */
  ancho?: boolean;
  /** En escritorio, detrás de todos los demás. */
  alFinal?: boolean;
  /** id para enlazar a este cuadro (navegación con ancla). */
  ancla?: string;
}

type NumColumnas = 1 | 2 | 3 | 4;

const DOS = '(min-width: 1024px)';
const TRES = '(min-width: 1536px)';
const CUATRO = '(min-width: 2400px)';

/** Separación entre cuadros, en px (la `gap-4` de siempre). */
export const HUECO = 16;
/** Cuánto se espera sin cambios de alto antes de dejar fija la columna de cada cuadro. */
const QUIETO_MS = 1500;
/** Y como mucho, desde que se monta (o cambia el número de columnas). */
const TOPE_MS = 9000;

function leer(): NumColumnas {
  if (typeof window === 'undefined' || !window.matchMedia) return 1;
  if (window.matchMedia(CUATRO).matches) return 4;
  return window.matchMedia(TRES).matches ? 3 : window.matchMedia(DOS).matches ? 2 : 1;
}

/** Cuántas columnas caben ahora (y se actualiza al cambiar el tamaño de la ventana). */
export function useNumColumnas(): NumColumnas {
  const [n, setN] = useState<NumColumnas>(leer);
  useEffect(() => {
    if (!window.matchMedia) return;
    const consultas = [window.matchMedia(DOS), window.matchMedia(TRES), window.matchMedia(CUATRO)];
    const cambio = () => setN(leer());
    consultas.forEach((q) => q.addEventListener('change', cambio));
    return () => consultas.forEach((q) => q.removeEventListener('change', cambio));
  }, []);
  return n;
}

/** Escritorio: desde 1024 px, donde todo va en una hoja y en columnas. */
export function useEsEscritorio(): boolean {
  return useNumColumnas() > 1;
}

/** Cuántos cuadros se prueban en todas las columnas, según cuántas haya (n^k combinaciones, unas pocas miles). */
const PRUEBAS: Record<number, number> = { 2: 13, 3: 8, 4: 7 };

/**
 * La columna de cada cuadro de un tramo (sin anchos), según su alto. Pura, para
 * probarla.
 *
 * Primero, en orden, cada uno a la columna más corta (a igualdad, la de más a la
 * izquierda), así que la primera fila sale en el orden de la lista. Después, los
 * últimos (todos, si son pocos; nunca el primero, que siempre va arriba a la
 * izquierda) se prueban en todas las columnas y se quedan donde la columna más
 * alta sea lo más baja posible: es lo que deja menos hueco al final. Dentro de
 * cada columna se mantiene el orden de la lista; a igualdad, el primer reparto.
 */
export function repartir(altos: readonly number[], n: number): number[] {
  const ocupa = (a: number) => (a > 0 ? a + HUECO : 0);
  const col = new Array<number>(altos.length).fill(0);
  const fondo = new Array<number>(n).fill(0);
  altos.forEach((a, i) => {
    const c = fondo.indexOf(Math.min(...fondo));
    col[i] = c;
    fondo[c]! += ocupa(a);
  });

  // Los que se prueban: los últimos con alto (los vacíos dan igual dónde vayan).
  const conAlto = altos.map((a, i) => (a > 0 ? i : -1)).filter((i) => i > 0);
  const cola = conAlto.slice(-(PRUEBAS[n] ?? 6));
  if (cola.length === 0) return col;
  const enCola = new Set(cola);

  const base = new Array<number>(n).fill(0);
  altos.forEach((a, i) => {
    if (!enCola.has(i)) base[col[i]!]! += ocupa(a);
  });
  let mejor = Math.max(...fondo);
  let mejorCola = cola.map((i) => col[i]!);
  const prueba = new Array<number>(cola.length).fill(0);
  const probar = (k: number, fondos: number[]) => {
    // Poda: si ya hay una columna más alta que el mejor reparto, no hay mejora.
    if (Math.max(...fondos) >= mejor - 1) return;
    if (k === cola.length) {
      mejor = Math.max(...fondos);
      mejorCola = prueba.slice();
      return;
    }
    const a = ocupa(altos[cola[k]!]!);
    for (let c = 0; c < n; c++) {
      prueba[k] = c;
      fondos[c]! += a;
      probar(k + 1, fondos);
      fondos[c]! -= a;
    }
  };
  probar(0, base);
  mejorCola.forEach((c, k) => (col[cola[k]!] = c));
  return col;
}

export function Columnas({ items }: { items: readonly ItemColumna[] }) {
  const n = useNumColumnas();

  if (n === 1) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {items.map((it) => (
          <div key={it.clave} id={it.ancla} className={cx('min-w-0', it.ancla && 'scroll-mt-3')}>
            {it.nodo}
          </div>
        ))}
      </div>
    );
  }

  return <ColumnasEscritorio items={items} n={n} />;
}

function ColumnasEscritorio({ items, n }: { items: readonly ItemColumna[]; n: number }) {
  const caja = useRef<HTMLDivElement>(null);
  // Alto de cada cuadro ABIERTO la última vez que se midió: plegado, se reparte
  // como si estuviera abierto, que es como nace.
  const medidos = useRef(new Map<string, number>());
  // La columna de cada cuadro; se rehace hasta que la pantalla se asienta.
  const columna = useRef(new Map<string, number>());
  const fija = useRef(false);

  const orden = useMemo(
    () => [...items.filter((it) => !it.alFinal), ...items.filter((it) => it.alFinal)],
    [items],
  );
  const claves = orden.map((it) => it.clave).join('|');
  const ordenRef = useRef(orden);
  ordenRef.current = orden;

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    fija.current = false;
    columna.current = new Map();
    let quieto: ReturnType<typeof setTimeout> | undefined;
    const fijar = () => {
      fija.current = true;
    };
    // Sin cambios de alto un rato y nada cargando: la pantalla se ha asentado.
    const alQuieto = () => {
      if (el.querySelector('.skeleton')) quieto = setTimeout(alQuieto, QUIETO_MS);
      else fijar();
    };
    const tope = setTimeout(fijar, TOPE_MS);

    const colocar = () => {
      const lista = ordenRef.current;
      const nodos = [...el.children] as HTMLElement[];
      const altos = nodos.map((nodo) => nodo.offsetHeight);
      let cambio = false;
      lista.forEach((it, i) => {
        const nodo = nodos[i];
        if (!nodo) return;
        const tarjeta = nodo.querySelector('details');
        if (tarjeta && !tarjeta.open) return;
        const antes = medidos.current.get(it.clave);
        if (antes == null || Math.abs(antes - altos[i]!) > 4) {
          medidos.current.set(it.clave, altos[i]!);
          cambio = true;
        }
      });

      // Mientras se asienta, cada cambio de alto vuelve a repartir; y no se da
      // por asentada mientras quede algún cuadro cargando (con su esqueleto).
      const nuevos = lista.some((it) => !columna.current.has(it.clave));
      if (!fija.current && (cambio || nuevos)) {
        clearTimeout(quieto);
        quieto = setTimeout(alQuieto, QUIETO_MS);
      }
      if (!fija.current || nuevos) {
        let tramo: number[] = [];
        const cerrar = () => {
          const altosTramo = tramo.map((i) => medidos.current.get(lista[i]!.clave) ?? lista[i]!.alto ?? 400);
          repartir(altosTramo, n).forEach((c, k) => {
            const clave = lista[tramo[k]!]!.clave;
            if (!fija.current || !columna.current.has(clave)) columna.current.set(clave, c);
          });
          tramo = [];
        };
        lista.forEach((it, i) => {
          if (it.ancho) cerrar();
          else tramo.push(i);
        });
        cerrar();
      }

      // Y dónde empieza cada uno, con los altos de ahora mismo.
      const fondo = new Array<number>(n).fill(0);
      lista.forEach((it, i) => {
        const nodo = nodos[i];
        if (!nodo) return;
        const alto = altos[i]!;
        if (it.ancho) {
          const y = Math.max(...fondo);
          nodo.style.top = `${y}px`;
          nodo.style.left = '0px';
          fondo.fill(alto > 0 ? y + alto + HUECO : y);
          return;
        }
        const c = Math.min(columna.current.get(it.clave) ?? 0, n - 1);
        nodo.style.top = `${fondo[c]}px`;
        nodo.style.left = `calc(${c} * ((100% - ${(n - 1) * HUECO}px) / ${n} + ${HUECO}px))`;
        if (alto > 0) fondo[c]! += alto + HUECO;
      });
      el.style.height = `${Math.max(0, Math.max(...fondo) - HUECO)}px`;
    };

    colocar();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(colocar);
    for (const nodo of el.children) ro?.observe(nodo);

    // Si el usuario pliega o despliega algo, ya está leyendo: nada cambia de columna.
    const alPulsar = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('summary')) fijar();
    };
    el.addEventListener('click', alPulsar, true);
    const soltarPlegado = subscribeCollapsibles(fijar);

    return () => {
      clearTimeout(quieto);
      clearTimeout(tope);
      ro?.disconnect();
      el.removeEventListener('click', alPulsar, true);
      soltarPlegado();
    };
  }, [n, claves]);

  const anchoCol = `calc((100% - ${(n - 1) * HUECO}px) / ${n})`;
  return (
    <div ref={caja} className="relative">
      {orden.map((it) => (
        <div
          key={it.clave}
          id={it.ancla}
          data-clave={it.clave}
          className={cx('absolute min-w-0', it.ancla && 'scroll-mt-20')}
          style={{ width: it.ancho ? '100%' : anchoCol }}
        >
          {it.nodo}
        </div>
      ))}
    </div>
  );
}
