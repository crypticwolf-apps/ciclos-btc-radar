import { lazy, Suspense, useEffect } from 'react';
import type { MarketData } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { useMarketData } from '@/hooks/useMarketData';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useCurrency } from '@/contexts/CurrencyContext';
import { TopBar } from '@/components/layout/TopBar';
import { Navigation } from '@/components/layout/Navigation';
import { HomeView } from '@/components/views/HomeView';
import { SettingsView } from '@/components/views/SettingsView';
import { LegalView } from '@/components/views/LegalView';
import { DashboardSkeleton, Skeleton } from '@/components/ui/LoadingSkeleton';
import { DeferUntilVisible } from '@/components/ui/DeferUntilVisible';
import { ErrorState } from '@/components/ui/ErrorState';

const CyclesSection = lazy(() => import('@/components/sections/CyclesSection').then((module) => ({ default: module.CyclesSection })));
const SummarySection = lazy(() => import('@/components/sections/SummarySection').then((module) => ({ default: module.SummarySection })));
const PriceChartCard = lazy(() => import('@/components/sections/PriceChartCard').then((module) => ({ default: module.PriceChartCard })));
const AnalysisView = lazy(() => import('@/components/views/AnalysisView').then((module) => ({ default: module.AnalysisView })));

export default function App() {
  const { theme, toggle } = useTheme();
  const { data, loading, refreshing, error, lastUpdated, refresh } = useMarketData();
  const { syncExchangeRate } = useCurrency();
  const navigation = useAppNavigation();

  useEffect(() => {
    syncExchangeRate(data?.usdToEur);
  }, [data?.usdToEur, syncExchangeRate]);

  return (
    <div className="app-shell min-h-screen overflow-x-clip">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <TopBar
        source={data?.source ?? (error ? 'stale' : 'mock')}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        error={error}
        onRefresh={refresh}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pt-5 lg:pb-8">
        <Navigation active={navigation.view} onChange={navigation.goTo} />
        <div id="view-content" className="min-w-0 scroll-mt-3">
          <Suspense fallback={<Skeleton className="h-[420px]" />}>
            <CurrentView
              view={navigation.view}
              data={data}
              loading={loading}
              error={error}
              refreshing={refreshing}
              onRefresh={refresh}
              theme={theme}
              onToggleTheme={toggle}
              onGoToScore={() => navigation.goTo('oportunidad')}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function CurrentView({
  view,
  data,
  loading,
  error,
  refreshing,
  onRefresh,
  theme,
  onToggleTheme,
  onGoToScore,
}: {
  view: ReturnType<typeof useAppNavigation>['view'];
  data: MarketData | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
  onToggleTheme: () => void;
  onGoToScore: () => void;
}) {
  if (view === 'ajustes') {
    return (
      <div className="space-y-3 sm:space-y-4">
        <SettingsView theme={theme} onToggleTheme={onToggleTheme} refreshing={refreshing} onRefresh={onRefresh} />
        <LegalView />
      </div>
    );
  }

  return (
    <DataGate data={data} loading={loading} error={error} onRetry={onRefresh}>
      {(market) => (
        <>
          {view === 'inicio' && (
            <div className="space-y-3 sm:space-y-4">
              <HomeView data={market} onGoToScore={onGoToScore} />
              {/* El gráfico arrastra la librería de charts (~98 kB gzip). Se
                  monta cuando se acerca a pantalla, no en la carga inicial. */}
              <DeferUntilVisible minHeight={360} placeholder={<Skeleton className="h-[360px]" />}>
                <PriceChartCard />
              </DeferUntilVisible>
            </div>
          )}
          {view === 'ciclos' && <CyclesSection data={market} />}
          {view === 'oportunidad' && <SummarySection data={market} />}
          {view === 'analisis' && <AnalysisView data={market} />}
        </>
      )}
    </DataGate>
  );
}

function DataGate({ data, loading, error, onRetry, children }: { data: MarketData | null; loading: boolean; error: string | null; onRetry: () => void; children: (data: MarketData) => React.ReactNode }) {
  if (loading && !data) return <DashboardSkeleton />;
  if (!data) return <ErrorState message={error ?? 'No hay datos disponibles en este momento.'} onRetry={onRetry} />;
  return children(data);
}

