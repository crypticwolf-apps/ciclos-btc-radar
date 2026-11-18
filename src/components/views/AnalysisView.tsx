import type { MarketData } from '@/types';
import { DeferUntilVisible } from '@/components/ui/DeferUntilVisible';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { Columnas, type ItemColumna } from '@/components/layout/Columnas';
import { MarketPressureCard } from '@/components/sections/MarketPressureCard';
import { LeverageCard } from '@/components/sections/LeverageCard';
import { NetworkCard } from '@/components/sections/NetworkCard';
import { DrawdownsSection } from '@/components/sections/DrawdownsSection';
import { RisingFloorSection } from '@/components/sections/RisingFloorSection';
import { SmartMoneySection } from '@/components/sections/SmartMoneySection';
import { RsiFearSection } from '@/components/sections/RsiFearSection';
import { OnchainSection } from '@/components/sections/OnchainSection';
import { MacroSection } from '@/components/sections/MacroSection';

// =============================================================================
// Vista ANÁLISIS: una lista de tarjetas, todas plegables por sí mismas.
//
// Antes cada bloque iba dentro de un desplegable propio que repetía el título
// de la tarjeta («Red Bitcoin» encima de «Red Bitcoin») y ponía dos flechas en
// la misma pantalla. Ahora la tarjeta ES el desplegable, y aquí solo se decide
// el orden y que su contenido se monte al acercarse a pantalla.
// =============================================================================

export function AnalysisView({ data }: { data: MarketData }) {
  // Análisis del móvil. En escritorio estos cuadros van en la hoja única
  // (views/ZonasDetalle), y el miedo y codicia, arriba, con lo esencial.
  // `alto`: lo que mide cada cuadro en un móvil, para que su hueco de espera
  // ocupe lo mismo y nada salte al montarse.
  const items: ItemColumna[] = [
    { clave: 'presion', alto: 347, nodo: <MarketPressureCard /> },
    { clave: 'apalancamiento', alto: 610, nodo: <LeverageCard data={data} /> },
    { clave: 'red', alto: 394, nodo: <NetworkCard /> },
    { clave: 'caidas', alto: 656, nodo: <DrawdownsSection data={data} /> },
    { clave: 'suelo', alto: 439, nodo: <RisingFloorSection data={data} /> },
    { clave: 'divergencia', alto: 668, nodo: <SmartMoneySection data={data} /> },
    { clave: 'rsi', alto: 543, nodo: <RsiFearSection data={data} parte="rsi" /> },
    { clave: 'miedo', alto: 456, nodo: <RsiFearSection data={data} parte="miedo" /> },
    { clave: 'onchain', alto: 979, nodo: <OnchainSection /> },
    { clave: 'macro', alto: 1103, nodo: <MacroSection data={data} parte="tablero" /> },
    { clave: 'liquidez', alto: 470, nodo: <MacroSection data={data} parte="liquidez" /> },
  ].map((it) => ({ ...it, nodo: <Lazy alto={it.alto}>{it.nodo}</Lazy> }));

  return <Columnas items={items} />;
}

function Lazy({ alto, children }: { alto: number; children: React.ReactNode }) {
  return (
    <DeferUntilVisible minHeight={alto} placeholder={<Skeleton className="h-full min-h-[inherit]" />}>
      {children}
    </DeferUntilVisible>
  );
}
