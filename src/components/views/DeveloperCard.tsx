import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Globe, Mail, Send } from 'lucide-react';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { cx } from '@/lib/format';

// =============================================================================
// Ajustes → «Desarrollado por CrypticWolf».
//
// Bloque de autoría, apoyo al proyecto y contacto. Usa las piezas que ya tiene
// la aplicación (tarjeta plegable, subtarjetas, tipografías y colores), así que
// no introduce estilos nuevos ni dependencias: los logotipos de Ethereum,
// Solana y Telegram van como SVG en línea, porque el juego de iconos del
// proyecto (lucide) no incluye marcas.
//
// La dirección se muestra COMPLETA y parte por caracteres (`break-all`): a
// 320 px una cadena de 44 caracteres no cabe de otra forma, y cortarla con
// puntos suspensivos dejaría al usuario sin poder comprobar lo que copia.
// =============================================================================

const WALLETS = [
  {
    id: 'eth',
    chain: 'Ethereum',
    ticker: 'ETH',
    address: '0x6Cb6eEC878C4bBF3eb464A597596cD6e8cF11B92',
    color: '#627eea',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" fillOpacity="0.6" d="M12 2 5.5 12.3 12 16.1l6.5-3.8z" />
        <path fill="currentColor" d="M12 2v14.1l6.5-3.8z" fillOpacity="0.95" />
        <path fill="currentColor" fillOpacity="0.6" d="M12 17.4 5.5 13.6 12 22l6.5-8.4z" />
      </svg>
    ),
  },
  {
    id: 'sol',
    chain: 'Solana',
    ticker: 'SOL',
    address: 'P1ZjaZzTMSDHWaCeLdp55DhJLsEupNYhNgKJDW1p77w',
    color: '#14f195',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M6.4 16.3a.8.8 0 0 1 .56-.23h13.9c.35 0 .53.43.28.68l-2.74 2.74a.8.8 0 0 1-.56.23H3.94a.4.4 0 0 1-.28-.68zM6.4 4.28A.8.8 0 0 1 6.96 4h13.9c.35 0 .53.43.28.68l-2.74 2.74a.8.8 0 0 1-.56.23H3.94a.4.4 0 0 1-.28-.68zM17.6 10.25a.8.8 0 0 0-.56-.23H3.14a.4.4 0 0 0-.28.68l2.74 2.74a.8.8 0 0 0 .56.23h13.9a.4.4 0 0 0 .28-.68z"
        />
      </svg>
    ),
  },
] as const;

const LINKS = [
  {
    label: 'Telegram',
    href: 'https://t.me/CryptoAtalaya',
    icon: <Send size={18} aria-hidden="true" />,
  },
  {
    label: 'CryptoAtalaya.com',
    href: 'https://cryptoatalaya.com/',
    icon: <Globe size={18} aria-hidden="true" />,
  },
  {
    label: 'Contacto',
    href: 'mailto:crypticwolfoficial@gmail.com',
    icon: <Mail size={18} aria-hidden="true" />,
  },
] as const;

export function DeveloperCard() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // El aviso se borra solo; si el componente desaparece antes, se cancela para
  // no tocar el estado de algo desmontado.
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function copyAddress(id: string, address: string) {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // El portapapeles moderno exige contexto seguro y permiso. Si falla, se
      // copia con el método antiguo antes de darse por vencido.
      const field = document.createElement('textarea');
      field.value = address;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(field);
      }
    }

    setCopied(id);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2200);
  }

  return (
    <CollapsibleCard
      title="Desarrollado por CrypticWolf"
      subtitle="Acerca del proyecto, apoyo y contacto"
      titleClassName="text-primary"
    >
      <p className="text-sm leading-relaxed text-secondary">
        Gracias por utilizar nuestra aplicación. Este proyecto ha sido desarrollado de forma
        independiente con el objetivo de seguir creando herramientas útiles dentro del ecosistema
        Bitcoin, blockchain y criptomonedas.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-secondary">
        Si Ciclos BTC te resulta útil, puedes apoyar su desarrollo y ayudar a impulsar futuras
        mejoras.
      </p>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">
        Apoya el desarrollo
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {WALLETS.map((w) => {
          const isCopied = copied === w.id;
          return (
            <div key={w.id} className="liquid-subcard min-w-0 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${w.color}1f`, color: w.color }}
                  >
                    {w.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-primary">
                      {w.chain}
                    </span>
                    <span className="block text-[11px] leading-tight text-muted">{w.ticker}</span>
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => void copyAddress(w.id, w.address)}
                  aria-label={`Copiar dirección de ${w.chain}`}
                  className={cx(
                    'liquid-action flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors',
                    // El «!» gana a `.liquid-action:hover`, que pinta de naranja
                    // el botón bajo el cursor y se comía el verde de confirmado.
                    isCopied ? '!text-bull' : 'text-secondary',
                  )}
                >
                  {isCopied ? <Check size={15} /> : <Copy size={15} />}
                  {isCopied ? 'Copiada' : 'Copiar'}
                </button>
              </div>

              <p className="mt-2 select-all break-all font-mono text-[11px] leading-relaxed text-muted">
                {w.address}
              </p>
            </div>
          );
        })}
      </div>

      {/* Un solo aviso para las dos tarjetas: los lectores de pantalla lo leen
          al cambiar, sin robar el foco del botón que acaba de pulsarse. */}
      <p aria-live="polite" className="mt-2 h-4 text-center text-xs text-bull">
        {copied ? 'Dirección copiada' : ''}
      </p>

      <div className="mt-4 flex items-center justify-center gap-3 border-t border-white/10 pt-4">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noreferrer noopener"
            title={l.label}
            aria-label={l.label}
            className="liquid-action group relative flex h-11 w-11 items-center justify-center rounded-xl text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:text-btc"
          >
            {l.icon}
            {/* Tooltip propio: el nativo tarda un segundo largo en aparecer. */}
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-black/80 px-2 py-1 text-[11px] text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {l.label}
            </span>
          </a>
        ))}
      </div>
    </CollapsibleCard>
  );
}
