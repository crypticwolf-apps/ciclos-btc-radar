import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react';

// =============================================================================
// Retrasa el montaje de un bloque pesado hasta que está a punto de verse.
//
// Para qué: la librería de gráficos pesa ~98 kB comprimidos. Montar el gráfico
// de precio nada más abrir la app la mete en la ruta crítica aunque el usuario
// aún no haya llegado a ella con el scroll. Con esto, el primer render de la
// pantalla de inicio no descarga la librería; se pide cuando el hueco del
// gráfico se acerca al viewport.
//
// Reserva la altura con `minHeight` para que no haya salto de diseño al montar.
//
// Los montajes van de uno en uno (ver la cola, abajo), y como transición: React
// los trocea y un toque o una tecla pasan por delante.
// =============================================================================

// --- Cola de montajes ----------------------------------------------------------
//
// Todos los montajes pasan por aquí, DE UNO EN UNO: el siguiente no empieza
// hasta que el anterior se ha dibujado. Antes, al abrir una pantalla, todos los
// cuadros que cabían a la vista se montaban en el mismo instante y los gráficos
// se medían y dibujaban de una tacada: tareas de 200-250 ms con la página
// bloqueada en un móvil modesto. Ahora cada uno va en su turno, y el primero
// aparece antes.
//
//   · urgentes: los que se acercan a pantalla, en el orden en que llegan;
//   · tranquilos: los que se montan por tope, cada uno en un rato libre.

const urgentes: Array<() => void> = [];
const tranquilos: Array<() => void> = [];
/** Un montaje en curso, esperando a dibujarse (`montado`). */
let enCurso = false;
let programado = false;
let seguro: ReturnType<typeof setTimeout> | undefined;

function enRatoLibre(fn: () => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 400 });
  else setTimeout(fn, 32);
}

function avanzar() {
  if (enCurso || programado) return;
  if (urgentes.length > 0) {
    programado = true;
    setTimeout(paso, 0);
  } else if (tranquilos.length > 0) {
    programado = true;
    enRatoLibre(paso);
  }
}

function paso() {
  programado = false;
  const montar = urgentes.shift() ?? tranquilos.shift();
  if (!montar) return;
  enCurso = true;
  montar();
  // Por si no llega a dibujarse (se desmontó entretanto): la cola no se para.
  seguro = setTimeout(montado, 400);
}

/** El último montaje ya se ha dibujado: el siguiente. */
function montado() {
  clearTimeout(seguro);
  if (!enCurso) return;
  enCurso = false;
  avanzar();
}

function pedir(montar: () => void, urgente: boolean) {
  sacar(montar);
  (urgente ? urgentes : tranquilos).push(montar);
  avanzar();
}

function sacar(montar: () => void) {
  for (const lista of [urgentes, tranquilos]) {
    const i = lista.indexOf(montar);
    if (i >= 0) lista.splice(i, 1);
  }
}

interface DeferUntilVisibleProps {
  children: ReactNode;
  /** Alto reservado mientras no se ha montado, para evitar saltos. */
  minHeight: number;
  /** Margen de anticipación: empieza a cargar antes de entrar en pantalla. */
  rootMargin?: string;
  /** Contenido del hueco reservado (un esqueleto, normalmente). */
  placeholder?: ReactNode;
  /** Tope de espera antes de montar igualmente. */
  fallbackMs?: number;
}

export function DeferUntilVisible({
  children,
  minHeight,
  rootMargin = '300px',
  placeholder,
  fallbackMs = 2500,
}: DeferUntilVisibleProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  // Ya dibujado: la cola sigue con el siguiente.
  useEffect(() => {
    if (visible) montado();
  }, [visible]);

  useEffect(() => {
    if (visible) return;
    const node = ref.current;

    const montar = () => startTransition(() => setVisible(true));

    // Red de seguridad: en una pestaña de fondo el navegador no ejecuta las
    // devoluciones de IntersectionObserver, así que sin esto el bloque podría
    // no montarse nunca. Pasado el tope se monta igual (a su turno en la cola);
    // el objetivo era sacarlo de la ruta crítica del primer render, y eso ya se
    // ha conseguido.
    const fallback = setTimeout(() => pedir(montar, false), fallbackMs);

    if (!node || typeof IntersectionObserver === 'undefined') {
      return () => {
        clearTimeout(fallback);
        sacar(montar);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          pedir(montar, true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);

    return () => {
      clearTimeout(fallback);
      sacar(montar);
      observer.disconnect();
    };
  }, [visible, rootMargin, fallbackMs]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : placeholder}
    </div>
  );
}
