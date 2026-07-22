import { lazy, Suspense, useEffect, useState } from 'react';
import type { SectionId } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { useMarketData } from '@/hooks/useMarketData';
import { useCurrency } from '@/contexts/CurrencyContext';

import { TopBar } from '@/components/layout/TopBar';
import { Hero } from '@/components/layout/Hero';
import { LiveStrip } from '@/components/layout/LiveStrip';
import { Navigation } from '@/components/layout/Navigation';
import { DisclaimerFooter } from '@/components/layout/DisclaimerFooter';

import { DashboardSkeleton, Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { DataFreshnessBadge } from '@/components/ui/DataFreshnessBadge';
import { HalvingCountdown } from '@/components/ui/HalvingCountdown';

// Carga diferida de las secciones: cada una (con sus gráficos de Recharts) se
// divide en un chunk propio y solo se descarga al abrir esa pestaña.
const CyclesSection = lazy(() =>
  import('@/components/sections/CyclesSection').then((m) => ({ default: m.CyclesSection })),
);
const DrawdownsSection = lazy(() =>
  import('@/components/sections/DrawdownsSection').then((m) => ({ default: m.DrawdownsSection })),
);
const RisingFloorSection = lazy(() =>
  import('@/components/sections/RisingFloorSection').then((m) => ({ default: m.RisingFloorSection })),
);
const SmartMoneySection = lazy(() =>
  import('@/components/sections/SmartMoneySection').then((m) => ({ default: m.SmartMoneySection })),
);
const RsiFearSection = lazy(() =>
  import('@/components/sections/RsiFearSection').then((m) => ({ default: m.RsiFearSection })),
);
const MacroSection = lazy(() =>
  import('@/components/sections/MacroSection').then((m) => ({ default: m.MacroSection })),
);
const SummarySection = lazy(() =>
  import('@/components/sections/SummarySection').then((m) => ({ default: m.SummarySection })),
);
const SourcesStatusSection = lazy(() =>
  import('@/components/sections/SourcesStatusSection').then((m) => ({
    default: m.SourcesStatusSection,
  })),
);
const PriceChartCard = lazy(() =>
  import('@/components/sections/PriceChartCard').then((m) => ({ default: m.PriceChartCard })),
);
const OnchainSection = lazy(() =>
  import('@/components/sections/OnchainSection').then((m) => ({ default: m.OnchainSection })),
);

export default function App() {
  const { theme, toggle } = useTheme();
  const { data, loading, refreshing, error, lastUpdated, refresh } = useMarketData();
  const { syncExchangeRate } = useCurrency();
  const [section, setSection] = useState<SectionId>('ciclos');

  useEffect(() => {
    syncExchangeRate(data?.usdToEur);
  }, [data?.usdToEur, syncExchangeRate]);

  return (
    <div className="app-shell min-h-screen overflow-x-clip">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <TopBar
        theme={theme}
        onToggleTheme={toggle}
        source={data?.source ?? 'mock'}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-8">
        {loading && !data ? (
          <DashboardSkeleton />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : data ? (
          <div className="space-y-4 sm:space-y-6">
            <Hero data={data} />

            <LiveStrip global={data.global} />

            <Suspense fallback={<Skeleton className="h-[360px]" />}>
              <PriceChartCard />
            </Suspense>

            <div className="flex items-center justify-between sm:hidden">
              <DataFreshnessBadge source={data.source} lastUpdated={lastUpdated} />
            </div>

            <Navigation active={section} onChange={setSection} />

            <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
              <HalvingCountdown info={data.halvingInfo} />
              <MiniScore data={data} onGoToSummary={() => setSection('resumen')} />
            </div>

            {/* Layout: contenido principal + columna lateral con el reloj del halving */}
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div id="section-content" className="min-w-0 scroll-mt-24">
                <Suspense fallback={<Skeleton className="h-[480px]" />}>
                  {section === 'ciclos' && <CyclesSection data={data} />}
                  {section === 'caidas' && <DrawdownsSection data={data} />}
                  {section === 'suelo' && <RisingFloorSection data={data} />}
                  {section === 'smart-money' && <SmartMoneySection data={data} />}
                  {section === 'rsi' && <RsiFearSection data={data} />}
                  {section === 'onchain' && <OnchainSection />}
                  {section === 'macro' && <MacroSection data={data} />}
                  {section === 'resumen' && <SummarySection data={data} />}
                  {section === 'estado' && <SourcesStatusSection />}
                </Suspense>
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-[120px] space-y-4">
                  <HalvingCountdown info={data.halvingInfo} />
                  <MiniScore data={data} onGoToSummary={() => setSection('resumen')} />
                </div>
              </aside>
            </div>

            <DisclaimerFooter />
          </div>
        ) : null}
      </main>
    </div>
  );
}

// Tarjeta lateral compacta con el score, enlazada a la sección de resumen.
function MiniScore({
  data,
  onGoToSummary,
}: {
  data: NonNullable<ReturnType<typeof useMarketData>['data']>;
  onGoToSummary: () => void;
}) {
  const { score, etiqueta } = data.opportunity;
  return (
    <button
      onClick={onGoToSummary}
      className="glass liquid-card w-full rounded-[22px] p-5 text-left"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        Score de oportunidad
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-extrabold text-btc">{score}</span>
        <span className="text-sm text-muted">/ 100</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-secondary">{etiqueta}</p>
      <p className="mt-2 text-xs text-macro">Ver desglose completo →</p>
    </button>
  );
}
