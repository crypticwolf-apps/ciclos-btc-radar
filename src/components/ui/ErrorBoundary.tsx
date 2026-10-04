import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { isChunkError, reloadOnce } from '@/lib/reloadOnChunkError';

// =============================================================================
// Barrera de errores: si una pantalla falla al dibujarse, se enseña un aviso
// con un botón para recargar en lugar de dejar la app en blanco (sin esto,
// React desmonta TODO y solo queda el fondo). Las pestañas siguen funcionando:
// al cambiar de pestaña (`resetKey`) se vuelve a intentar.
//
// Si el fallo es que falta un fichero de la app tras publicar una versión
// nueva, se recarga sola una vez (ver lib/reloadOnChunkError).
// =============================================================================

interface Props {
  children: ReactNode;
  /** Al cambiar, la barrera se reinicia (por ejemplo, al cambiar de pestaña). */
  resetKey?: string;
  /** Pantalla completa (barrera de toda la app) o solo la zona de contenido. */
  fullScreen?: boolean;
}

interface State {
  error: Error | null;
  resetKey?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Cambio de pestaña: se olvida el error y se vuelve a intentar.
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (isChunkError(error) && reloadOnce()) return;
    console.error('Error al dibujar la pantalla', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const version = isChunkError(error);
    return (
      <div
        role="alert"
        className={
          this.props.fullScreen
            ? 'flex min-h-screen items-center justify-center p-6'
            : 'flex min-h-[40vh] items-center justify-center p-2'
        }
      >
        <div className="liquid-subcard max-w-md rounded-2xl p-5 text-center">
          <h2 className="text-base font-bold text-primary">
            {version ? 'Hay una versión nueva de la app' : 'Algo ha fallado al mostrar esta pantalla'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            {version
              ? 'Se ha publicado una actualización mientras tenías la app abierta. Recarga para usar la versión nueva.'
              : 'Los datos no se han perdido. Recarga la página; si vuelve a pasar, prueba otra pestaña y vuelve.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="liquid-action mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-primary"
          >
            <RefreshCw size={16} className="text-btc" aria-hidden="true" /> Recargar
          </button>
        </div>
      </div>
    );
  }
}
