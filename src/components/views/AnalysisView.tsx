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
  // En el orden del móvil; en escritorio, en columnas (layout/Columnas) según la
  // altura aproximada de cada tarjeta. Las secciones de dos tarjetas (RSI y
  // miedo y codicia; tablero macro y ciclo de liquidez) van por separado para
  // repartirse mejor.
  const items: ItemColumna[] = [
    { clave: 'presion', alto: 300, nodo: <MarketPressureCard /> },
    { clave: 'apalancamiento', alto: 480, nodo: <LeverageCard data={data} /> },
    { clave: 'red', alto: 320, nodo: <NetworkCard /> },
    { clave: 'caidas', alto: 700, nodo: <DrawdownsSection data={data} /> },
    { clave: 'suelo', alto: 580, nodo: <RisingFloorSection data={data} /> },
    { clave: 'divergencia', alto: 520, nodo: <SmartMoneySection data={data} /> },
    { clave: 'rsi', alto: 520, nodo: <RsiFearSection data={data} parte="rsi" /> },
    { clave: 'miedo', alto: 540, nodo: <RsiFearSection data={data} parte="miedo" /> },
    { clave: 'onchain', alto: 900, nodo: <OnchainSection /> },
    { clave: 'macro', alto: 760, nodo: <MacroSection data={data} parte="tablero" /> },
    { clave: 'liquidez', alto: 560, nodo: <MacroSection data={data} parte="liquidez" /> },
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
