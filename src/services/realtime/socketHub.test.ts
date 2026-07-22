import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SocketHub } from './socketHub';

// =============================================================================
// WebSocket falso: permite ejercitar reconexión, recuento de suscriptores y
// vigilante de silencio sin tocar la red.
// =============================================================================

class FakeSocket {
  static instances: FakeSocket[] = [];
  static get openCount(): number {
    return FakeSocket.instances.filter((s) => s.readyState === 1).length;
  }

  readyState = 0; // 0 conectando, 1 abierto, 3 cerrado
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(public readonly url: string) {
    FakeSocket.instances.push(this);
  }

  /** Simula que el servidor acepta la conexión. */
  accept(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  /** Simula una trama entrante. */
  emit(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  /** Simula una caída del lado del servidor. */
  drop(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.();
  }

  static reset(): void {
    FakeSocket.instances = [];
  }
}

function makeHub(overrides = {}) {
  return new SocketHub({
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    baseDelayMs: 100,
    maxDelayMs: 400,
    maxAttempts: 3,
    stallMs: 1000,
    lingerMs: 500,
    ...overrides,
  });
}

/** Última instancia creada (la conexión "viva"). */
const latest = () => FakeSocket.instances[FakeSocket.instances.length - 1]!;

beforeEach(() => {
  FakeSocket.reset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SocketHub · conexión compartida', () => {
  it('abre UNA sola conexión aunque se suscriban varios componentes', () => {
    const hub = makeHub();
    const a = vi.fn();
    const b = vi.fn();

    hub.subscribe('wss://x/stream', a);
    hub.subscribe('wss://x/stream', b);

    expect(FakeSocket.instances).toHaveLength(1);

    latest().accept();
    latest().emit({ precio: 1 });

    // La misma trama llega a todos los suscriptores.
    expect(a).toHaveBeenCalledWith({ precio: 1 });
    expect(b).toHaveBeenCalledWith({ precio: 1 });

    hub.dispose();
  });

  it('no cierra la conexión mientras quede algún suscriptor', () => {
    const hub = makeHub();
    const cancelarA = hub.subscribe('wss://x/stream', vi.fn());
    hub.subscribe('wss://x/stream', vi.fn());
    latest().accept();

    cancelarA();
    vi.advanceTimersByTime(2000);

    expect(latest().readyState).toBe(1);
    hub.dispose();
  });

  it('mantiene la conexión durante el margen de gracia al quedarse sin suscriptores', () => {
    // Es el caso de cambiar de pestaña: React desmonta la vista antigua antes
    // de montar la nueva, y el contador pasa por cero un instante.
    const hub = makeHub();
    const cancelar = hub.subscribe('wss://x/stream', vi.fn());
    latest().accept();

    cancelar();
    vi.advanceTimersByTime(200); // dentro del margen
    expect(latest().readyState).toBe(1);

    // Vuelve un suscriptor: debe reutilizarse la MISMA conexión.
    hub.subscribe('wss://x/stream', vi.fn());
    vi.advanceTimersByTime(2000);

    expect(FakeSocket.instances).toHaveLength(1);
    expect(latest().readyState).toBe(1);
    hub.dispose();
  });

  it('cierra la conexión si nadie vuelve dentro del margen', () => {
    const hub = makeHub();
    const cancelar = hub.subscribe('wss://x/stream', vi.fn());
    latest().accept();

    cancelar();
    vi.advanceTimersByTime(600); // supera lingerMs

    expect(latest().readyState).toBe(3);
    hub.dispose();
  });

  it('cancelar dos veces no descuadra el recuento', () => {
    const hub = makeHub();
    const cancelar = hub.subscribe('wss://x/stream', vi.fn());
    hub.subscribe('wss://x/stream', vi.fn());
    latest().accept();

    cancelar();
    cancelar(); // idempotente

    vi.advanceTimersByTime(2000);
    expect(latest().readyState).toBe(1); // el segundo suscriptor sigue vivo
    hub.dispose();
  });
});

describe('SocketHub · reconexión', () => {
  it('reconecta con backoff exponencial tras una caída', () => {
    const hub = makeHub();
    hub.subscribe('wss://x/stream', vi.fn());
    latest().accept();
    expect(FakeSocket.instances).toHaveLength(1);

    latest().drop();

    // Antes del primer retardo no debe haber reintentado todavía.
    vi.advanceTimersByTime(50);
    expect(FakeSocket.instances).toHaveLength(1);

    // baseDelayMs=100 ±20% de jitter: a los 200 ms ya ha reintentado.
    vi.advanceTimersByTime(200);
    expect(FakeSocket.instances).toHaveLength(2);

    // Segunda caída: el retardo crece (~200 ms).
    latest().accept();
    latest().drop();
    vi.advanceTimersByTime(400);
    expect(FakeSocket.instances).toHaveLength(3);

    hub.dispose();
  });

  it('deja de reintentar al agotar el máximo de intentos (cortacircuitos)', () => {
    const hub = makeHub({ maxAttempts: 2 });
    const estados: string[] = [];
    hub.subscribe('wss://x/stream', vi.fn(), (s) => estados.push(s));

    // Cada intento falla nada más abrirse.
    for (let i = 0; i < 6; i++) {
      latest().drop();
      vi.advanceTimersByTime(1000);
    }

    // 1 inicial + 2 reintentos = 3 conexiones, y ni una más.
    expect(FakeSocket.instances).toHaveLength(3);
    expect(estados[estados.length - 1]).toBe('sin-conexion');

    hub.dispose();
  });

  it('reconecta si el socket queda abierto pero deja de enviar datos', () => {
    const hub = makeHub();
    hub.subscribe('wss://x/stream', vi.fn());
    latest().accept();
    latest().emit({ ok: 1 });

    // El vigilante comprueba cada max(5 s, stallMs/3), así que hay que superar
    // ese suelo de 5 s además del propio stallMs.
    vi.advanceTimersByTime(6000);
    vi.advanceTimersByTime(300); // margen para el backoff

    expect(FakeSocket.instances.length).toBeGreaterThan(1);
    hub.dispose();
  });

  it('no vigila el silencio cuando se pide watchSilence: false', () => {
    // Caso de las liquidaciones: no recibir nada es normal.
    const hub = makeHub();
    hub.subscribe('wss://x/stream', vi.fn(), undefined, { watchSilence: false });
    latest().accept();

    vi.advanceTimersByTime(5000);

    expect(FakeSocket.instances).toHaveLength(1);
    expect(latest().readyState).toBe(1);
    hub.dispose();
  });
});

describe('SocketHub · robustez', () => {
  it('ignora tramas que no son JSON sin romper el canal', () => {
    const hub = makeHub();
    const listener = vi.fn();
    hub.subscribe('wss://x/stream', listener);
    latest().accept();

    latest().onmessage?.({ data: 'esto no es json' });
    expect(listener).not.toHaveBeenCalled();

    latest().emit({ bien: true });
    expect(listener).toHaveBeenCalledWith({ bien: true });

    hub.dispose();
  });

  it('un suscriptor que lanza excepción no impide la entrega a los demás', () => {
    const hub = makeHub();
    const roto = vi.fn(() => {
      throw new Error('fallo del componente');
    });
    const sano = vi.fn();
    hub.subscribe('wss://x/stream', roto);
    hub.subscribe('wss://x/stream', sano);
    latest().accept();

    latest().emit({ v: 1 });

    expect(roto).toHaveBeenCalled();
    expect(sano).toHaveBeenCalledWith({ v: 1 });
    hub.dispose();
  });

  it('dispose cierra todas las conexiones y no reconecta', () => {
    const hub = makeHub();
    hub.subscribe('wss://a/stream', vi.fn());
    hub.subscribe('wss://b/stream', vi.fn());
    FakeSocket.instances.forEach((s) => s.accept());

    hub.dispose();

    expect(FakeSocket.openCount).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(FakeSocket.instances).toHaveLength(2); // ninguna reconexión
  });
});
