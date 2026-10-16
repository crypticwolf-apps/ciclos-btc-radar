import { useEffect, useState, type ReactNode } from 'react';

// =============================================================================
// Columnas de escritorio: las tarjetas de una pestaña repartidas en columnas
// según el ancho del monitor, para aprovechar la pantalla y bajar lo mínimo.
//
//   · Móvil y tableta (menos de 1024 px): una columna, exactamente como antes.
//   · Desde 1024 px, dos columnas; desde 1536 px, tres.
//
// Cada tarjeta lleva su altura aproximada (`alto`, en px) y se coloca, en orden,
// en la columna que va más corta. El reparto es FIJO para cada ancho: depende de
// esas alturas estimadas, no de las reales, así que plegar o desplegar un cuadro
// no mueve las demás de columna. Una tarjeta puede pedir su columna (`col`) u
// ocupar todo el ancho (`ancho`), y entonces corta el reparto en dos tramos; con
// `alFinal`, en escritorio va detrás de todas (una tabla ancha, por ejemplo),
// sin cambiar el orden del móvil.
// =============================================================================

export interface ItemColumna {
  clave: string;
  nodo: ReactNode;
  /** Altura aproximada en px, para repartir. */
  alto: number;
  /** Ocupa todas las columnas. */
  ancho?: boolean;
  /** Columna fija con 2 y con 3 columnas (si no, la más corta). */
  col?: { 2?: number; 3?: number };
  /** En escritorio, detrás de todas las demás. */
  alFinal?: boolean;
}

type NumColumnas = 1 | 2 | 3;

const DOS = '(min-width: 1024px)';
const TRES = '(min-width: 1536px)';

function leer(): NumColumnas {
  if (typeof window === 'undefined' || !window.matchMedia) return 1;
  return window.matchMedia(TRES).matches ? 3 : window.matchMedia(DOS).matches ? 2 : 1;
}

/** Cuántas columnas caben ahora (y se actualiza al cambiar el tamaño de la ventana). */
export function useNumColumnas(): NumColumnas {
  const [n, setN] = useState<NumColumnas>(leer);
  useEffect(() => {
    if (!window.matchMedia) return;
    const consultas = [window.matchMedia(DOS), window.matchMedia(TRES)];
    const cambio = () => setN(leer());
    consultas.forEach((q) => q.addEventListener('change', cambio));
    return () => consultas.forEach((q) => q.removeEventListener('change', cambio));
  }, []);
  return n;
}

/** Reparte en `n` columnas: cada tarjeta, a la suya fija o a la más corta. Pura, para probarla. */
export function repartir(items: readonly ItemColumna[], n: number): ItemColumna[][] {
  const cols: ItemColumna[][] = Array.from({ length: n }, () => []);
  const altos = new Array<number>(n).fill(0);
  for (const it of items) {
    const fija = n === 2 ? it.col?.[2] : n === 3 ? it.col?.[3] : undefined;
    const i = fija != null && fija >= 0 && fija < n ? fija : altos.indexOf(Math.min(...altos));
    cols[i]!.push(it);
    altos[i]! += it.alto;
  }
  return cols;
}

/** Tramos: los anchos van solos; lo demás, junto, entre uno y otro. */
function tramos(items: readonly ItemColumna[]): { ancho: boolean; items: ItemColumna[] }[] {
  const out: { ancho: boolean; items: ItemColumna[] }[] = [];
  for (const it of items) {
    const ultimo = out[out.length - 1];
    if (it.ancho) out.push({ ancho: true, items: [it] });
    else if (ultimo && !ultimo.ancho) ultimo.items.push(it);
    else out.push({ ancho: false, items: [it] });
  }
  return out;
}

export function Columnas({ items }: { items: readonly ItemColumna[] }) {
  const n = useNumColumnas();

  if (n === 1) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {items.map((it) => (
          <div key={it.clave} className="min-w-0">
            {it.nodo}
          </div>
        ))}
      </div>
    );
  }

  const orden = [...items.filter((it) => !it.alFinal), ...items.filter((it) => it.alFinal)];

  return (
    <div className="space-y-4">
      {tramos(orden).map((t, k) =>
        t.ancho ? (
          <div key={t.items[0]!.clave} className="min-w-0">
            {t.items[0]!.nodo}
          </div>
        ) : (
          <div key={k} className="grid items-start gap-4" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {repartir(t.items, n).map((col, i) => (
              <div key={i} className="flex min-w-0 flex-col gap-4">
                {col.map((it) => (
                  <div key={it.clave} className="min-w-0">
                    {it.nodo}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
