// =============================================================================
// Gestor central de WebSockets.
// -----------------------------------------------------------------------------
// Reglas que impone este módulo (y por las que existe):
//
//   · UNA sola conexión por URL, compartida por todos los componentes. Los
//     suscriptores se cuentan; al llegar a cero la conexión se cierra sola, así
//     que no quedan sockets huérfanos al cambiar de pestaña.
//   · Reconexión con backoff exponencial + jitter y un tope de intentos
//     (cortacircuitos): nunca puede entrar en un bucle de reconexión.
//   · Pausa cuando la pestaña deja de estar visible y reconexión ordenada al
//     volver, para no gastar batería ni datos en segundo plano.
//   · Vigilante de silencio: si el socket está abierto pero no llega nada en
//     `stallMs`, se fuerza la reconexión (una conexión "zombi" no se detecta
//     sola, el navegador no cierra el socket).
//
// No depende de React: se prueba en Node inyectando un WebSocket falso.
// =============================================================================

export type SocketStatus = 'inactivo' | 'conectando' | 'abierto' | 'reconectando' | 'sin-conexion';

export interface SocketHubOptions {
  /** Constructor de WebSocket (inyectable para los tests). */
  WebSocketImpl?: typeof WebSocket;
  /** Reintentos antes de darse por vencido. */
  maxAttempts?: number;
  /** Retardo base del backoff, en ms. */
  baseDelayMs?: number;
  /** Retardo máximo entre reintentos, en ms. */
  maxDelayMs?: number;
  /** Si no llega ningún mensaje en este tiempo, se reconecta. */
  stallMs?: number;
  /** Margen tras ocultarse la pestaña antes de cerrar. */
  hiddenGraceMs?: number;
  /**
   * Margen que se mantiene abierta una conexión sin suscriptores.
   *
   * Es lo que evita el ciclo cerrar/abrir al cambiar de pestaña: React desmonta
   * la vista antigua ANTES de montar la nueva, así que el contador pasa por cero
   * un instante aunque la conexión se vaya a seguir usando. También absorbe el
   * doble montaje de StrictMode en desarrollo.
   */
  lingerMs?: number;
}

type MessageListener = (payload: unknown) => void;
type StatusListener = (status: SocketStatus) => void;

interface Channel {
  url: string;
  socket: WebSocket | null;
  status: SocketStatus;
  attempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  stallTimer: ReturnType<typeof setInterval> | null;
  lastMessageAt: number;
  /** Si es `false`, el silencio prolongado no fuerza reconexión. */
  watchSilence: boolean;
  /** Cuenta atrás para cerrar por falta de suscriptores. */
  lingerTimer: ReturnType<typeof setTimeout> | null;
  /** El cierre lo pedimos nosotros: no debe disparar reconexión. */
  closingOnPurpose: boolean;
  messageListeners: Set<MessageListener>;
  statusListeners: Set<StatusListener>;
}

export class SocketHub {
  private readonly channels = new Map<string, Channel>();
  private readonly opts: Required<Omit<SocketHubOptions, 'WebSocketImpl'>> & {
    WebSocketImpl: typeof WebSocket | undefined;
  };
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;
  private disposed = false;

  constructor(options: SocketHubOptions = {}) {
    this.opts = {
      WebSocketImpl: options.WebSocketImpl,
      maxAttempts: options.maxAttempts ?? 8,
      baseDelayMs: options.baseDelayMs ?? 1000,
      maxDelayMs: options.maxDelayMs ?? 30_000,
      stallMs: options.stallMs ?? 45_000,
      hiddenGraceMs: options.hiddenGraceMs ?? 30_000,
      lingerMs: options.lingerMs ?? 8000,
    };
    this.bindVisibility();
  }

  /**
   * Suscribe a una URL. Si ya hay conexión para esa URL, la reutiliza.
   * Devuelve la función para darse de baja.
   *
   * `watchSilence: false` desactiva el vigilante para streams donde no recibir
   * nada es NORMAL (por ejemplo, liquidaciones: en un mercado tranquilo pueden
   * pasar minutos sin ninguna). Reconectar ahí sería contraproducente.
   */
  subscribe(
    url: string,
    onMessage: MessageListener,
    onStatus?: StatusListener,
    channelOptions: { watchSilence?: boolean } = {},
  ): () => void {
    const channel = this.channels.get(url) ?? this.createChannel(url);
    if (channelOptions.watchSilence === false) channel.watchSilence = false;

    // Llega un suscriptor: se cancela cualquier cierre pendiente y se reutiliza
    // la conexión que ya estaba abierta.
    if (channel.lingerTimer) {
      clearTimeout(channel.lingerTimer);
      channel.lingerTimer = null;
    }

    channel.messageListeners.add(onMessage);
    if (onStatus) {
      channel.statusListeners.add(onStatus);
      onStatus(channel.status); // estado inicial inmediato
    }

    if (!channel.socket && !this.paused) this.open(channel);

    let released = false;
    return () => {
      if (released) return; // idempotente: cancelar dos veces no descuadra el recuento
      released = true;
      channel.messageListeners.delete(onMessage);
      if (onStatus) channel.statusListeners.delete(onStatus);
      if (channel.messageListeners.size > 0 || channel.lingerTimer) return;

      channel.lingerTimer = setTimeout(() => {
        channel.lingerTimer = null;
        // Solo se cierra si en todo el margen no ha vuelto nadie.
        if (channel.messageListeners.size === 0) this.closeChannel(channel, true);
      }, this.opts.lingerMs);
    };
  }

  /** Estado actual de una URL (para el panel «En vivo»). */
  statusOf(url: string): SocketStatus {
    return this.channels.get(url)?.status ?? 'inactivo';
  }

  /** Cierra todo. Se usa al desmontar la app y en los tests. */
  dispose(): void {
    this.disposed = true;
    for (const channel of [...this.channels.values()]) this.closeChannel(channel, true);
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
  }

  // --- interno --------------------------------------------------------------

  private createChannel(url: string): Channel {
    const channel: Channel = {
      url,
      socket: null,
      status: 'inactivo',
      attempts: 0,
      reconnectTimer: null,
      stallTimer: null,
      lastMessageAt: 0,
      watchSilence: true,
      lingerTimer: null,
      closingOnPurpose: false,
      messageListeners: new Set(),
      statusListeners: new Set(),
    };
    this.channels.set(url, channel);
    return channel;
  }

  private setStatus(channel: Channel, status: SocketStatus): void {
    if (channel.status === status) return;
    channel.status = status;
    for (const listener of channel.statusListeners) listener(status);
  }

  private resolveWebSocket(): typeof WebSocket | null {
    if (this.opts.WebSocketImpl) return this.opts.WebSocketImpl;
    if (typeof WebSocket !== 'undefined') return WebSocket;
    return null;
  }

  private open(channel: Channel): void {
    if (this.disposed || this.paused || channel.socket) return;

    const Impl = this.resolveWebSocket();
    if (!Impl) {
      this.setStatus(channel, 'sin-conexion');
      return;
    }

    this.setStatus(channel, channel.attempts === 0 ? 'conectando' : 'reconectando');
    channel.closingOnPurpose = false;

    let socket: WebSocket;
    try {
      socket = new Impl(channel.url);
    } catch {
      this.scheduleReconnect(channel);
      return;
    }
    channel.socket = socket;

    socket.onopen = () => {
      channel.attempts = 0;
      channel.lastMessageAt = Date.now();
      this.setStatus(channel, 'abierto');
      this.startStallWatch(channel);
    };

    socket.onmessage = (event: MessageEvent) => {
      channel.lastMessageAt = Date.now();
      let payload: unknown;
      try {
        payload = JSON.parse(typeof event.data === 'string' ? event.data : '');
      } catch {
        return; // trama no-JSON: se ignora, no rompe el canal
      }
      for (const listener of channel.messageListeners) {
        try {
          listener(payload);
        } catch {
          // Un suscriptor que falle no puede tumbar a los demás ni al socket.
        }
      }
    };

    socket.onerror = () => {
      // `onclose` llega siempre después: la reconexión se gestiona allí.
    };

    socket.onclose = () => {
      this.stopStallWatch(channel);
      channel.socket = null;
      if (channel.closingOnPurpose || this.disposed) return;
      if (channel.messageListeners.size === 0) return; // ya no interesa a nadie
      this.scheduleReconnect(channel);
    };
  }

  private scheduleReconnect(channel: Channel): void {
    if (channel.reconnectTimer || this.paused || this.disposed) return;

    if (channel.attempts >= this.opts.maxAttempts) {
      // Cortacircuitos: se deja de insistir hasta que la pestaña vuelva a estar
      // visible (ahí se reinicia el contador) o el usuario recargue.
      this.setStatus(channel, 'sin-conexion');
      return;
    }

    const exponential = Math.min(
      this.opts.baseDelayMs * 2 ** channel.attempts,
      this.opts.maxDelayMs,
    );
    const jitter = exponential * (Math.random() * 0.4 - 0.2); // ±20%
    channel.attempts += 1;
    this.setStatus(channel, 'reconectando');

    channel.reconnectTimer = setTimeout(() => {
      channel.reconnectTimer = null;
      this.open(channel);
    }, Math.max(250, Math.round(exponential + jitter)));
  }

  private startStallWatch(channel: Channel): void {
    this.stopStallWatch(channel);
    if (!channel.watchSilence) return;
    channel.stallTimer = setInterval(() => {
      if (Date.now() - channel.lastMessageAt < this.opts.stallMs) return;
      // Socket abierto pero mudo: lo damos por muerto y reconectamos.
      const socket = channel.socket;
      channel.socket = null;
      this.stopStallWatch(channel);
      try {
        socket?.close();
      } catch {
        /* ya estaba cerrado */
      }
      this.scheduleReconnect(channel);
    }, Math.max(5000, Math.round(this.opts.stallMs / 3)));
  }

  private stopStallWatch(channel: Channel): void {
    if (channel.stallTimer) clearInterval(channel.stallTimer);
    channel.stallTimer = null;
  }

  private closeChannel(channel: Channel, forget: boolean): void {
    channel.closingOnPurpose = true;
    this.stopStallWatch(channel);
    if (channel.reconnectTimer) clearTimeout(channel.reconnectTimer);
    channel.reconnectTimer = null;
    if (channel.lingerTimer) clearTimeout(channel.lingerTimer);
    channel.lingerTimer = null;
    try {
      channel.socket?.close();
    } catch {
      /* ya estaba cerrado */
    }
    channel.socket = null;
    this.setStatus(channel, 'inactivo');
    if (forget && channel.messageListeners.size === 0) {
      this.channels.delete(channel.url);
    }
  }

  private bindVisibility(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.schedulePause();
      else this.resume();
    });
  }

  /** Al ocultarse la pestaña esperamos un poco: cambiar de app un segundo no
   *  debe tirar la conexión. */
  private schedulePause(): void {
    if (this.hiddenTimer) return;
    this.hiddenTimer = setTimeout(() => {
      this.hiddenTimer = null;
      this.paused = true;
      for (const channel of this.channels.values()) {
        channel.closingOnPurpose = true;
        this.stopStallWatch(channel);
        if (channel.reconnectTimer) clearTimeout(channel.reconnectTimer);
        channel.reconnectTimer = null;
        try {
          channel.socket?.close();
        } catch {
          /* ya estaba cerrado */
        }
        channel.socket = null;
        this.setStatus(channel, 'inactivo');
      }
    }, this.opts.hiddenGraceMs);
  }

  private resume(): void {
    if (this.hiddenTimer) {
      clearTimeout(this.hiddenTimer);
      this.hiddenTimer = null;
    }
    if (!this.paused) return;
    this.paused = false;
    for (const channel of this.channels.values()) {
      if (channel.messageListeners.size === 0) continue;
      channel.attempts = 0; // volver al primer plano reinicia el cortacircuitos
      this.open(channel);
    }
  }
}

/** Instancia compartida por toda la aplicación. */
export const socketHub = new SocketHub();
