import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Una zona de la hoja de escritorio (Inicio, Ciclos, Temperatura, Análisis): el
 * sitio al que baja cada botón del menú. Con título fino, salvo Inicio, que es
 * lo primero que se ve. Si algo de dentro falla al dibujarse, cae solo esta zona.
 */
export function Zona({
  id,
  titulo,
  icono: Icono,
  children,
}: {
  id: string;
  titulo?: string;
  icono?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section
      id={`zona-${id}`}
      aria-labelledby={titulo ? `titulo-${id}` : undefined}
      aria-label={titulo ? undefined : 'Inicio'}
      className="scroll-mt-20"
    >
      {titulo && (
        <h2
          id={`titulo-${id}`}
          className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted"
        >
          {Icono && <Icono size={14} strokeWidth={2.5} className="text-btc" aria-hidden="true" />}
          {titulo}
          <span className="h-px flex-1 bg-gradient-to-r from-orange-400/60 via-orange-400/15 to-transparent" aria-hidden="true" />
        </h2>
      )}
      <ErrorBoundary resetKey={id}>{children}</ErrorBoundary>
    </section>
  );
}
