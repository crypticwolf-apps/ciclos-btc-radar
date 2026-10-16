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
  const items: ItemColumna[] = [
    { clave: 'presion', nodo: <MarketPressureCard /> },
    { clave: 'apalancamiento', nodo: <LeverageCard data={data} /> },
    { clave: 'red', nodo: <NetworkCard /> },
    { clave: 'caidas', nodo: <DrawdownsSection data={data} /> },
    { clave: 'suelo', nodo: <RisingFloorSection data={data} /> },
    { clave: 'divergencia', nodo: <SmartMoneySection data={data} /> },
    { clave: 'rsi', nodo: <RsiFearSection data={data} parte="rsi" /> },
    { clave: 'miedo', nodo: <RsiFearSection data={data} parte="miedo" /> },
    { clave: 'onchain', nodo: <OnchainSection /> },
    { clave: 'macro', nodo: <MacroSection data={data} parte="tablero" /> },
    { clave: 'liquidez', nodo: <MacroSection data={data} parte="liquidez" /> },
  ].map((it) => ({ ...it, nodo: <Lazy>{it.nodo}</Lazy> }));

  return <Columnas items={items} />;
}

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <DeferUntilVisible minHeight={120} placeholder={<Skeleton className="h-[120px]" />}>
      {children}
    </DeferUntilVisible>
  );
}
