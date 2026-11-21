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
// a montar: siguen siendo los mismos elementos, solo cambia su posición. Y un
// cuadro que ya está a la vista no cambia de columna ni mientras se asienta: se
// reparten a su alrededor los que aún no se ven.
//
// Al final, los cuadros de las columnas más cortas se alargan lo justo para que
// todas acaben a la misma altura: cada zona queda cuadrada, sin huecos. Si el
// cuadro lleva un gráfico marcado con `data-crece`, crece el gráfico, no un
// hueco vacío al pie de la tarjeta.
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
  /** Alto aproximado de su gráfico, si lleva uno que puede crecer (`data-crece`), hasta que se mide. */
  grafico?: number;
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
 * izquierda) se prueban en todas las columnas y se quedan donde menos hueco
 * haya que rellenar al final (sin gráficos, donde la columna más alta sea lo
 * más baja posible). Dentro de cada columna se mantiene el orden de la lista; a
 * igualdad, el primer reparto.
 *
 * `fijos`: la columna que ya tiene cada cuadro que no se debe mover (los que el
 * usuario ya ha visto); el resto se reparte alrededor de ellos.
 *
 * `graficos`: el alto del gráfico de cada cuadro que puede crecer al alargarlo
 * (0 si no tiene). Entre repartos casi igual de parejos, se elige el que deja
 * lo que falta en columnas con gráfico: crece el gráfico en vez de quedar un
 * hueco vacío al pie de una tarjeta.
 */
export function repartir(
  altos: readonly number[],
  n: number,
  fijos: readonly (number | undefined)[] = [],
  graficos: readonly number[] = [],
): number[] {
  const ocupa = (a: number) => (a > 0 ? a + HUECO : 0);
  const col = new Array<number>(altos.length).fill(0);
  const fondo = new Array<number>(n).fill(0);
  altos.forEach((a, i) => {
    const fijo = fijos[i];
    const c = fijo != null && fijo < n ? fijo : fondo.indexOf(Math.min(...fondo));
    col[i] = c;
    fondo[c]! += ocupa(a);
  });

  // Los que se prueban: los últimos con alto (los vacíos dan igual dónde vayan),
  // salvo los que tienen ya su columna fija.
  const conAlto = altos.map((a, i) => (a > 0 && fijos[i] == null ? i : -1)).filter((i) => i > 0);
  const cola = conAlto.slice(-(PRUEBAS[n] ?? 6));
  if (cola.length === 0) return col;
  const enCola = new Set(cola);

  const base = new Array<number>(n).fill(0);
  const baseGrafico = new Array<number>(n).fill(0);
  altos.forEach((a, i) => {
    if (enCola.has(i)) return;
    base[col[i]!]! += ocupa(a);
    baseGrafico[col[i]!]! += graficos[i] ?? 0;
  });

  // Lo que cuesta un reparto: el hueco que habrá que rellenar alargando
  // cuadros. Si en una columna hay gráficos, lo que ellos absorben (hasta su
  // propio alto) cuesta poco: es gráfico, no hueco vacío. Y un poco la altura,
  // que a igualdad de hueco se prefiere la hoja más corta.
  const coste = (fondos: readonly number[], crecen: readonly number[]) => {
    const meta = Math.max(...fondos);
    let c = 0.1 * meta;
    for (let k = 0; k < n; k++) {
      const falta = meta - fondos[k]!;
      const absorbe = Math.min(falta, crecen[k]!);
      c += falta - absorbe + 0.2 * absorbe;
    }
    return c;
  };

  const inicialGrafico = [...baseGrafico];
  cola.forEach((i) => (inicialGrafico[col[i]!]! += graficos[i] ?? 0));
  let mejor = coste(fondo, inicialGrafico);
  let mejorCola = cola.map((i) => col[i]!);
  const prueba = new Array<number>(cola.length).fill(0);
  const probar = (k: number, fondos: number[], crecen: number[]) => {
    if (k === cola.length) {
      const c = coste(fondos, crecen);
      // Solo si mejora de verdad: a igualdad, el primer reparto.
      if (c < mejor - 1) {
        mejor = c;
        mejorCola = prueba.slice();
      }
      return;
    }
    const i = cola[k]!;
    const a = ocupa(altos[i]!);
    const g = graficos[i] ?? 0;
    for (let c = 0; c < n; c++) {
      prueba[k] = c;
      fondos[c]! += a;
      crecen[c]! += g;
      probar(k + 1, fondos, crecen);
      fondos[c]! -= a;
      crecen[c]! -= g;
    }
  };
  probar(0, base, baseGrafico);
  mejorCola.forEach((c, k) => (col[cola[k]!] = c));
  return col;
}

/**
 * Cuánto alargar cada cuadro de un tramo para que todas sus columnas acaben a la
 * misma altura, la de la más alta: así cada zona queda cuadrada, sin huecos al
 * final. Lo que le falta a cada columna se reparte entre sus cuadros que se
 * pueden alargar, en proporción a su alto; si en la columna hay cuadros con un
 * gráfico que puede crecer (`crece`), solo entre ellos, para que lo alargado sea
 * gráfico y no un hueco vacío al pie de la tarjeta. Una columna con algún cuadro
 * plegado no se toca: lo ha plegado el usuario y estirar los demás para tapar el
 * hueco los dejaría enormes y vacíos. Pura, para probarla.
 */
export function estirar(
  altos: readonly number[],
  cols: readonly number[],
  n: number,
  estirable: readonly boolean[],
  plegado: readonly boolean[] = [],
  crece: readonly boolean[] = [],
): number[] {
  const extra = new Array<number>(altos.length).fill(0);
  const fondo = new Array<number>(n).fill(0);
  altos.forEach((a, i) => {
    if (a > 0) fondo[cols[i]!]! += a + HUECO;
  });
  const meta = Math.max(...fondo);
  for (let c = 0; c < n; c++) {
    const falta = meta - fondo[c]!;
    if (falta < 1) continue;
    const enCol = altos.map((_, i) => i).filter((i) => cols[i] === c && altos[i]! > 0);
    if (enCol.some((i) => plegado[i])) continue;
    const alargables = enCol.filter((i) => estirable[i]);
    // Primero los que llevan un gráfico: el gráfico crece y no queda hueco.
    const conGrafico = alargables.filter((i) => crece[i]);
    const candidatos = conGrafico.length > 0 ? conGrafico : alargables;
    const total = candidatos.reduce((s, i) => s + altos[i]!, 0);
    if (total <= 0) continue;
    let dado = 0;
    candidatos.forEach((i, k) => {
      const parte = k === candidatos.length - 1 ? falta - dado : Math.floor((falta * altos[i]!) / total);
      extra[i] = parte;
      dado += parte;
    });
  }
  return extra;
}

/** La tarjeta de un cuadro: la que se alarga para cuadrar la columna. */
function tarjetaDe(nodo: HTMLElement): HTMLElement | null {
  return nodo.querySelector<HTMLElement>('.liquid-card, .glass, .glass-strong');
}

/** El gráfico de un cuadro que puede crecer al alargarlo (`data-crece`), el más alto. */
function graficoDe(tarjeta: HTMLElement | null): HTMLElement | null {
  if (!tarjeta) return null;
  let mejor: HTMLElement | null = null;
  for (const g of tarjeta.querySelectorAll<HTMLElement>('[data-crece]')) {
    if (g.offsetHeight > (mejor?.offsetHeight ?? 0)) mejor = g;
  }
  return mejor;
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

  // Nunca más columnas que cuadros: con pocos (un bloque corto en una pantalla
  // ancha) quedaría una columna vacía, un hueco que no se puede cuadrar.
  const enColumnas = items.filter((it) => !it.ancho).length;
  return <ColumnasEscritorio items={items} n={Math.max(1, Math.min(n, enColumnas))} />;
}

function ColumnasEscritorio({ items, n }: { items: readonly ItemColumna[]; n: number }) {
  const caja = useRef<HTMLDivElement>(null);
  // Alto de cada cuadro ABIERTO la última vez que se midió: plegado, se reparte
  // como si estuviera abierto, que es como nace.
  const medidos = useRef(new Map<string, number>());
  // Y el alto natural de su gráfico que puede crecer (0 si no lleva).
  const medidosGrafico = useRef(new Map<string, number>());
  // La columna de cada cuadro; se rehace hasta que la pantalla se asienta.
  const columna = useRef(new Map<string, number>());
  // Los cuadros que ya se han visto en pantalla con su columna: ni esos ni los
  // de antes cambian ya de columna aunque la pantalla aún se esté asentando.
  // Antes, mientras cargaba, los de arriba se intercambiaban varias veces a la
  // vista.
  const vistos = useRef(new Set<string>());
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
    vistos.current = new Set();
    let quieto: ReturnType<typeof setTimeout> | undefined;
    let alFijar = 0;
    const fijar = () => {
      if (fija.current) return;
      fija.current = true;
      // Ya asentada: se cuadra lo que quedara sin cuadrar.
      alFijar = requestAnimationFrame(() => colocar());
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
      // Primero se quita lo que se alargó la vez anterior, para medir el alto
      // natural de cada cuadro.
      const tarjetas = nodos.map(tarjetaDe);
      for (const t of tarjetas) if (t?.style.minHeight) t.style.minHeight = '';
      for (const g of el.querySelectorAll<HTMLElement>('[data-crecido]')) {
        g.style.height = '';
        delete g.dataset.crecido;
      }
      const altos = nodos.map((nodo) => nodo.offsetHeight);
      const altosTarjeta = tarjetas.map((t) => t?.offsetHeight ?? 0);
      const plegado = nodos.map((nodo) => {
        const d = nodo.querySelector('details');
        return d != null && !d.open;
      });
      const cargando = nodos.map((nodo) => nodo.querySelector('.skeleton') != null);
      const graficos = tarjetas.map(graficoDe);
      const estirable = nodos.map((_, i) => altos[i]! > 0 && !plegado[i] && tarjetas[i] != null && !cargando[i]);
      let cambio = false;
      lista.forEach((it, i) => {
        const nodo = nodos[i];
        if (!nodo) return;
        if (plegado[i]) return;
        // Mientras carga (con su esqueleto), su alto aún no es el suyo: para
        // repartir cuenta el previsto. Antes se repartía con el alto del
        // esqueleto y los cuadros cambiaban de columna al terminar de cargar.
        if (cargando[i]) return;
        const antes = medidos.current.get(it.clave);
        if (antes == null || Math.abs(antes - altos[i]!) > 4) {
          medidos.current.set(it.clave, altos[i]!);
          cambio = true;
        }
        const grafico = graficos[i]?.offsetHeight ?? 0;
        if (Math.abs((medidosGrafico.current.get(it.clave) ?? -99) - grafico) > 4) {
          medidosGrafico.current.set(it.clave, grafico);
          cambio = true;
        }
      });

      // Los que están a la vista donde se colocaron la última vez se quedan en
      // su columna a partir de ahora.
      if (!fija.current) {
        const arriba = el.getBoundingClientRect().top;
        lista.forEach((it, i) => {
          const nodo = nodos[i];
          if (!nodo || !columna.current.has(it.clave) || !nodo.style.top) return;
          const y = arriba + parseFloat(nodo.style.top);
          if (y < window.innerHeight && y + altos[i]! > 0) vistos.current.add(it.clave);
        });
      }

      // Mientras se asienta, cada cambio de alto vuelve a repartir; y no se da
      // por asentada mientras quede algún cuadro cargando (con su esqueleto).
      const nuevos = lista.some((it) => !it.ancho && !columna.current.has(it.clave));
      if (!fija.current && (cambio || nuevos)) {
        clearTimeout(quieto);
        quieto = setTimeout(alQuieto, QUIETO_MS);
      }
      if (!fija.current || nuevos) {
        let tramo: number[] = [];
        const cerrar = () => {
          const altosTramo = tramo.map((i) => medidos.current.get(lista[i]!.clave) ?? lista[i]!.alto ?? 400);
          // No se mueve nada de lo que va antes del último cuadro visto: un
          // cuadro que entra o sale de una columna por encima de otro lo empuja.
          let ultimoVisto = -1;
          tramo.forEach((i, k) => {
            if (vistos.current.has(lista[i]!.clave)) ultimoVisto = k;
          });
          const fijos = tramo.map((i, k) => (k <= ultimoVisto ? columna.current.get(lista[i]!.clave) : undefined));
          // Un cuadro que dice llevar gráfico lo lleva, aunque aún no se haya
          // dibujado (mientras carga, medido da 0).
          const graficosTramo = tramo.map((i) => {
            const medido = medidosGrafico.current.get(lista[i]!.clave) ?? 0;
            return medido > 0 ? medido : (lista[i]!.grafico ?? 0);
          });
          repartir(altosTramo, n, fijos, graficosTramo).forEach((c, k) => {
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

      // Lo que se alarga cada cuadro para que su tramo quede cuadrado.
      const extra = new Array<number>(lista.length).fill(0);
      let tramo: number[] = [];
      const cuadrar = () => {
        // Mientras algo del tramo carga, nada se alarga: se alargaban mucho los
        // ya cargados (todo lo que faltaba iba a ellos) y luego se encogían, y
        // todo lo de debajo subía y bajaba. Se cuadra al terminar de cargar (o
        // al asentarse la pantalla, si algo no termina nunca).
        if (!fija.current && tramo.some((i) => cargando[i])) {
          tramo = [];
          return;
        }
        const cols = tramo.map((i) => Math.min(columna.current.get(lista[i]!.clave) ?? 0, n - 1));
        estirar(
          tramo.map((i) => altos[i]!),
          cols,
          n,
          tramo.map((i) => estirable[i]!),
          tramo.map((i) => plegado[i]!),
          tramo.map((i) => graficos[i] != null),
        ).forEach((e, k) => (extra[tramo[k]!] = e));
        tramo = [];
      };
      lista.forEach((it, i) => {
        if (it.ancho) cuadrar();
        else tramo.push(i);
      });
      cuadrar();

      // Y dónde empieza cada uno, con los altos de ahora mismo.
      const fondo = new Array<number>(n).fill(0);
      lista.forEach((it, i) => {
        const nodo = nodos[i];
        if (!nodo) return;
        // Cuánto se ha alargado y cuánto de eso es hueco al pie (sin gráfico
        // que lo ocupe): para las pruebas y para mirarlo en el navegador.
        delete nodo.dataset.alargado;
        delete nodo.dataset.hueco;
        if (extra[i]! > 0) {
          tarjetas[i]!.style.minHeight = `${altosTarjeta[i]! + extra[i]!}px`;
          // Lo alargado va al gráfico (hasta el doble de su alto); lo que pase de
          // ahí queda al pie, que lo sujeta el alto mínimo de la tarjeta.
          const g = graficos[i];
          let crece = 0;
          if (g) {
            const natural = g.offsetHeight;
            crece = Math.min(extra[i]!, natural);
            g.style.height = `${natural + crece}px`;
            g.dataset.crecido = '';
          }
          nodo.dataset.alargado = String(extra[i]);
          if (extra[i]! - crece > 0) nodo.dataset.hueco = String(extra[i]! - crece);
        }
        const alto = altos[i]! + extra[i]!;
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
    // Un cuadro alargado que se pliega no cambia de alto (lo sujeta lo que se
    // alargó), así que el observador no se entera: se recoloca al plegar.
    let cuadro = 0;
    const alPlegar = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(colocar);
    };
    el.addEventListener('toggle', alPlegar, true);

    return () => {
      clearTimeout(quieto);
      clearTimeout(tope);
      cancelAnimationFrame(cuadro);
      cancelAnimationFrame(alFijar);
      ro?.disconnect();
      el.removeEventListener('click', alPulsar, true);
      el.removeEventListener('toggle', alPlegar, true);
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
