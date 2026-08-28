import type { MarketData } from '@/types';
import { DeferUntilVisible } from '@/components/ui/DeferUntilVisible';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
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
  return (
    <div className="space-y-3 sm:space-y-4">
      <Lazy>
        <MarketPressureCard />
      </Lazy>
      <Lazy>
        <LeverageCard data={data} />
      </Lazy>
      <Lazy>
        <NetworkCard />
      </Lazy>
      <Lazy>
        <DrawdownsSection data={data} />
      </Lazy>
      <Lazy>
        <RisingFloorSection data={data} />
      </Lazy>
      <Lazy>
        <SmartMoneySection data={data} />
      </Lazy>
      <Lazy>
        <RsiFearSection data={data} />
      </Lazy>
      <Lazy>
        <OnchainSection />
      </Lazy>
      <Lazy>
        <MacroSection data={data} />
      </Lazy>
    </div>
  );
}

/**
 * Monta su contenido al acercarse a pantalla. La vista mide más de 10.000 px en
 * móvil y montaba de golpe los ocho bloques, con todo lo que eso arrastra de
 * recharts.
 */
function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <DeferUntilVisible minHeight={120} placeholder={<Skeleton className="h-[120px]" />}>
      {children}
    </DeferUntilVisible>
  );
}
