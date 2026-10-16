import { lazy, memo, Suspense } from 'react';
import type { MarketData } from '@/types';
import { Columnas, type ItemColumna } from '@/components/layout/Columnas';
import { Zona } from '@/components/layout/Zona';
import { PriceChartCard } from '@/components/sections/PriceChartCard';
import { PrecioEnVivo } from '@/components/ui/PrecioEnVivo';
import { FaseActualCard } from '@/components/sections/FaseActualCard';
import { TermometroCard } from '@/components/sections/TermometroCard';
import { MiedoCodiciaCard } from '@/components/sections/MiedoCodiciaCard';
import { AltseasonResumen } from '@/components/altseason/AltseasonResumenCard';
import { DondeEstaCadaCicloCard } from '@/components/views/CyclesComparisonView';
import { EnVista } from '@/components/ui/EnVista';
import { Skeleton } from '@/components/ui/LoadingSkeleton';

// =============================================================================
// ESCRITORIO (desde 1024 px): todo en una sola hoja, sin pestañas ni
// subpestañas, y cada cuadro una sola vez.
//
//   · Inicio: lo esencial, lo que se ve sin bajar (precio en vivo con su
//     gráfico, fase actual, temperatura, miedo y codicia, el Altseason Score y
//     dónde está cada ciclo).
//   · Ciclos, Temperatura y Análisis: el detalle de cada tema (ZonasDetalle,
//     que se descarga aparte: lleva la librería de gráficos).
//
// El menú de la barra superior baja deslizando a cada zona y se marca solo al
// bajar; Ajustes no está en la hoja: se abre en un panel (layout/PanelAjustes).
// En el móvil nada de esto: sigue con sus pestañas.
// =============================================================================

const ZonasDetalle = lazy(() => import('./ZonasDetalle').then((m) => ({ default: m.ZonasDetalle })));

export const HojaEscritorio = memo(function HojaEscritorio({ data }: { data: MarketData }) {
  // El alto de cada uno es solo una estimación hasta que se mide el real.
  const inicio: ItemColumna[] = [
    { clave: 'precio', alto: 700, nodo: <PriceChartCard cabecera={<PrecioEnVivo data={data} />} /> },
    { clave: 'fase', alto: 800, nodo: <FaseActualCard fase={data.fase} /> },
    { clave: 'termometro', alto: 470, nodo: <TermometroCard data={data} /> },
    { clave: 'miedo', alto: 540, nodo: <MiedoCodiciaCard data={data} /> },
    { clave: 'altseason', alto: 450, nodo: <AltseasonResumen /> },
    // Dónde va el ciclo de Bitcoin y dónde la rotación de las altcoins: también
    // de un vistazo (y con tres columnas cabe justo bajo la fase).
    {
      clave: 'donde',
      alto: 330,
      ancla: 'zona-comparativa',
      nodo: <EnVista>{(visible) => <DondeEstaCadaCicloCard data={data} vivo={visible} />}</EnVista>,
    },
  ];

  return (
    <div className="space-y-6">
      <Zona id="inicio">
        <Columnas items={inicio} />
      </Zona>
      <Suspense fallback={<Skeleton className="h-[900px]" />}>
        <ZonasDetalle data={data} />
      </Suspense>
    </div>
  );
});
