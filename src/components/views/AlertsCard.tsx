import { useEffect, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { cx } from '@/lib/format';

// =============================================================================
// Ajustes → Alertas: avisos en el móvil cuando cambia la fase del ciclo, cuando
// el Altseason Score cruza de tramo o cuando el Fear & Greed llega a un
// extremo. Lo que decide cuándo avisar está en el servidor (api/_lib/alerts.ts);
// aquí solo se pide permiso, se suscribe el navegador y se eligen los avisos.
//
// La tarjeta no aparece si el servidor no tiene las alertas activadas.
// En iPhone, Safari solo admite avisos con la app instalada en la pantalla de
// inicio (iOS 16.4 o posterior), y se explica en lugar del botón.
// =============================================================================

type Kind = 'fase' | 'altseason' | 'miedo';
type Prefs = Record<Kind, boolean>;

const OPCIONES: { id: Kind; label: string; detalle: string }[] = [
  { id: 'fase', label: 'Cambio de fase del ciclo', detalle: 'Acumulación, expansión, euforia, corrección…' },
  { id: 'altseason', label: 'Altseason cruza de tramo', detalle: 'Por ejemplo, de «Mercado mixto» a «Altseason probable»' },
  { id: 'miedo', label: 'Miedo o codicia extremos', detalle: 'Fear & Greed en 20 o menos, o en 80 o más' },
];
const PREFS_KEY = 'ciclos-alertas-prefs';
const DEFAULT_PREFS: Prefs = { fase: true, altseason: true, miedo: true };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}
function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: las preferencias viven igual en el servidor */
  }
}

/** Clave VAPID (base64url) al formato que pide `pushManager.subscribe`. */
function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIos = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register('/sw.js');
}

async function post(accion: string, subscription: PushSubscription, prefs?: Prefs): Promise<Record<string, unknown>> {
  const res = await fetch('/api/alertas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, subscription: subscription.toJSON(), prefs }),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: Record<string, unknown>; error?: string } | null;
  if (!res.ok || !body?.ok) throw new Error(body?.error ?? `Error ${res.status}`);
  return body.data ?? {};
}

export function AlertsCard() {
  const [publicKey, setPublicKey] = useState<string | null | undefined>(undefined);
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch('/api/alertas')
      .then((r) => r.json())
      .then((b: { data?: { configured?: boolean; publicKey?: string | null } }) => {
        if (!cancel) setPublicKey(b.data?.configured ? (b.data.publicKey ?? null) : null);
      })
      .catch(() => !cancel && setPublicKey(null));
    if (pushSupported()) {
      void navigator.serviceWorker
        .getRegistration()
        .then((reg) => reg?.pushManager.getSubscription())
        .then((s) => !cancel && setSub(s ?? null));
    }
    return () => {
      cancel = true;
    };
  }, []);

  // Sin alertas en el servidor (o aún comprobándolo) no hay tarjeta.
  if (!publicKey) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setAviso(null);
    try {
      await fn();
    } catch (err) {
      setAviso({ tono: 'error', texto: err instanceof Error ? err.message : 'No se ha podido completar.' });
    } finally {
      setBusy(false);
    }
  };

  const activar = () =>
    run(async () => {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        throw new Error('Sin permiso para avisos. Actívalo en los ajustes del navegador para este sitio.');
      }
      const reg = await registration();
      const s =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
      await post('suscribir', s, prefs);
      setSub(s);
      setAviso({ tono: 'ok', texto: 'Alertas activadas en este dispositivo.' });
    });

  const desactivar = () =>
    run(async () => {
      if (!sub) return;
      await post('baja', sub).catch(() => undefined);
      await sub.unsubscribe();
      setSub(null);
      setAviso({ tono: 'ok', texto: 'Alertas desactivadas.' });
    });

  const probar = () =>
    run(async () => {
      if (!sub) return;
      const r = await post('prueba', sub);
      setAviso(
        r.enviado
          ? { tono: 'ok', texto: 'Aviso de prueba enviado: debería llegarte en unos segundos.' }
          : { tono: 'error', texto: 'No se ha podido entregar el aviso de prueba.' },
      );
    });

  const cambiar = (id: Kind) => {
    const next = { ...prefs, [id]: !prefs[id] };
    setPrefs(next);
    savePrefs(next);
    if (sub) void run(async () => void (await post('suscribir', sub, next)));
  };

  const soportado = pushSupported();
  const necesitaInstalar = isIos() && !isStandalone();

  return (
    <CollapsibleCard
      title="Alertas"
      titleClassName="text-primary"
      subtitle={sub ? 'Activadas en este dispositivo' : 'Avisos en el móvil cuando algo cambia'}
      icon={sub ? <Bell size={18} className="text-btc" /> : <BellOff size={18} className="text-muted" />}
      defaultOpen={false}
    >
      <div className="space-y-3">
        <ul className="space-y-1.5">
          {OPCIONES.map((o) => (
            <li key={o.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[#f59e0b]"
                  checked={prefs[o.id]}
                  disabled={busy}
                  onChange={() => cambiar(o.id)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-secondary">{o.label}</span>
                  <span className="block text-[11px] leading-tight text-muted">{o.detalle}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {necesitaInstalar ? (
          <p className="rounded-xl border border-btc/30 bg-btc/5 px-3 py-2.5 text-xs leading-relaxed text-secondary">
            En iPhone los avisos solo funcionan con la app instalada: en Safari pulsa{' '}
            <strong>Compartir → Añadir a pantalla de inicio</strong>, ábrela desde el icono y vuelve aquí.
          </p>
        ) : !soportado ? (
          <p className="text-xs text-muted">Este navegador no admite avisos.</p>
        ) : sub ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={probar} disabled={busy} className="liquid-action flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-secondary disabled:opacity-60">
              <Send size={17} className="text-btc" /> Enviar aviso de prueba
            </button>
            <button type="button" onClick={desactivar} disabled={busy} className="liquid-action flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-secondary disabled:opacity-60">
              <BellOff size={17} className="text-muted" /> Desactivar
            </button>
          </div>
        ) : (
          <button type="button" onClick={activar} disabled={busy} className="liquid-action flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-primary disabled:opacity-60">
            <Bell size={17} className="text-btc" /> {busy ? 'Activando…' : 'Activar alertas'}
          </button>
        )}

        {aviso && (
          <p className={cx('text-xs', aviso.tono === 'ok' ? 'text-bull' : 'text-bear')} role="status">
            {aviso.texto}
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-muted">
          Se revisa cada hora mientras alguien usa la app y, como mínimo, una vez al día. Un cambio de
          fase se confirma en dos revisiones seguidas antes de avisar, para no mandar falsas alarmas.
        </p>
      </div>
    </CollapsibleCard>
  );
}
