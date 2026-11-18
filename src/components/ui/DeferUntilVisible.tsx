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
// Los que se montan por tope (sin haberse acercado a pantalla) van de uno en
// uno, cada uno en un rato libre del navegador: antes se montaban todos en el
// mismo instante y, en la hoja de escritorio, eso bloqueaba la página casi medio
// segundo en un ordenador modesto. Y todo montaje va como transición: React lo
// trocea y un toque o una tecla pasan por delante.
// =============================================================================

// --- Cola de montajes por tope ----------------------------------------------

const cola: Array<() => void> = [];
let enMarcha = false;

function enRatoLibre(fn: () => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 400 });
  else setTimeout(fn, 32);
}

function siguiente() {
  const montar = cola.shift();
  if (!montar) {
    enMarcha = false;
    return;
  }
  montar();
  enRatoLibre(siguiente);
}

function encolar(montar: () => void) {
  cola.push(montar);
  if (enMarcha) return;
  enMarcha = true;
  enRatoLibre(siguiente);
}

function sacar(montar: () => void) {
  const i = cola.indexOf(montar);
  if (i >= 0) cola.splice(i, 1);
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

  useEffect(() => {
    if (visible) return;
    const node = ref.current;

    const montar = () => startTransition(() => setVisible(true));

    // Red de seguridad: en una pestaña de fondo el navegador no ejecuta las
    // devoluciones de IntersectionObserver, así que sin esto el bloque podría
    // no montarse nunca. Pasado el tope se monta igual (a su turno en la cola);
    // el objetivo era sacarlo de la ruta crítica del primer render, y eso ya se
    // ha conseguido.
    const fallback = setTimeout(() => encolar(montar), fallbackMs);

    if (!node || typeof IntersectionObserver === 'undefined') {
      return () => {
        clearTimeout(fallback);
        sacar(montar);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          sacar(montar);
          montar();
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
