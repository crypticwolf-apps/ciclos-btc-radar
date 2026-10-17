import { memo } from 'react';
import type { MarketData } from '@/types';
import { TarjetasFijas } from '@/components/ui/Collapsible';
import { ZonasDetalle } from './ZonasDetalle';

// =============================================================================
// ESCRITORIO (desde 1024 px): todo en una sola hoja, sin pestañas ni
// subpestañas, cada cuadro una sola vez y en su sitio: las zonas Ciclos,
// Temperatura y Análisis, con lo mismo que las pestañas del móvil
// (views/ZonasDetalle). Los cuadros van siempre desplegados y fijos, y cada zona
// queda cuadrada: sus columnas acaban a la misma altura (layout/Columnas).
//
// El menú de la barra superior baja deslizando a cada zona y se marca solo al
// bajar; «Inicio» solo sube arriba del todo. Ajustes no está en la hoja: se abre
// en un panel (layout/PanelAjustes). En el móvil nada de esto: sigue con sus
// pestañas.
// =============================================================================

export const HojaEscritorio = memo(function HojaEscritorio({ data }: { data: MarketData }) {
  return (
    <TarjetasFijas>
      <div className="space-y-6">
        <ZonasDetalle data={data} />
      </div>
    </TarjetasFijas>
  );
});
