import { lazy, Suspense, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { MarketData, MoreView } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { useMarketData } from '@/hooks/useMarketData';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useCurrency } from '@/contexts/CurrencyContext';
import { TopBar } from '@/components/layout/TopBar';
import { Navigation } from '@/components/layout/Navigation';
import { HomeView } from '@/components/views/HomeView';
import { MoreHub } from '@/components/views/MoreHub';
import { SettingsView } from '@/components/views/SettingsView';
import { LegalView } from '@/components/views/LegalView';
import { DashboardSkeleton, Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';

const CyclesSection = lazy(() => import('@/components/sections/CyclesSection').then((module) => ({ default: module.CyclesSection })));
const DrawdownsSection = lazy(() => import('@/components/sections/DrawdownsSection').then((module) => ({ default: module.DrawdownsSection })));
const RisingFloorSection = lazy(() => import('@/components/sections/RisingFloorSection').then((module) => ({ default: module.RisingFloorSection })));
const SmartMoneySection = lazy(() => import('@/components/sections/SmartMoneySection').then((module) => ({ default: module.SmartMoneySection })));
const RsiFearSection = lazy(() => import('@/components/sections/RsiFearSection').then((module) => ({ default: module.RsiFearSection })));
const MacroSection = lazy(() => import('@/components/sections/MacroSection').then((module) => ({ default: module.MacroSection })));
const SummarySection = lazy(() => import('@/components/sections/SummarySection').then((module) => ({ default: module.SummarySection })));
const PriceChartCard = lazy(() => import('@/components/sections/PriceChartCard').then((module) => ({ default: module.PriceChartCard })));
const OnchainSection = lazy(() => import('@/components/sections/OnchainSection').then((module) => ({ default: module.OnchainSection })));

const MORE_TITLES: Record<Exclude<MoreView, 'menu'>, string> = {
  caidas: 'CaÃ­das y recuperaciones',
  suelo: 'Suelo ascendente',
  'smart-money': 'Smart money',
  rsi: 'RSI y miedo',
  onchain: 'Datos on-chain',
  macro: 'Ciclo macroeconÃ³mico',
  ajustes: 'Ajustes',
  legal: 'Aviso legal',
};

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
              more={navigation.more}
              data={data}
              loading={loading}
              error={error}
              refreshing={refreshing}
              onRefresh={refresh}
              theme={theme}
              onToggleTheme={toggle}
              onNavigate={navigation.goTo}
              onOpenMore={navigation.openMore}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function CurrentView({
  view,
  more,
  data,
  loading,
  error,
  refreshing,
  onRefresh,
  theme,
  onToggleTheme,
  onNavigate,
  onOpenMore,
}: {
  view: ReturnType<typeof useAppNavigation>['view'];
  more: MoreView;
  data: MarketData | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
  onToggleTheme: () => void;
  onNavigate: ReturnType<typeof useAppNavigation>['goTo'];
  onOpenMore: ReturnType<typeof useAppNavigation>['openMore'];
}) {
  if (view === 'precio') return <PriceChartCard />;

  if (view === 'mas') {
    if (more === 'menu') return <MoreHub onOpen={onOpenMore} />;
    return (
      <div className="space-y-3 sm:space-y-4">
        <SecondaryHeader title={MORE_TITLES[more]} onBack={() => onOpenMore('menu')} />
        {more === 'ajustes' && <SettingsView theme={theme} onToggleTheme={onToggleTheme} refreshing={refreshing} onRefresh={onRefresh} />}
        {more === 'legal' && <LegalView />}
        {more === 'onchain' && <OnchainSection />}
        {more !== 'ajustes' && more !== 'legal' && more !== 'onchain' && (
          <DataGate data={data} loading={loading} error={error} onRetry={onRefresh}>
            {(market) => (
              <>
                {more === 'caidas' && <DrawdownsSection data={market} />}
                {more === 'suelo' && <RisingFloorSection data={market} />}
                {more === 'smart-money' && <SmartMoneySection data={market} />}
                {more === 'rsi' && <RsiFearSection data={market} />}
                {more === 'macro' && <MacroSection data={market} />}
              </>
            )}
          </DataGate>
        )}
      </div>
    );
  }

  return (
    <DataGate data={data} loading={loading} error={error} onRetry={onRefresh}>
      {(market) => (
        <>
          {view === 'inicio' && <HomeView data={market} onNavigate={onNavigate} />}
          {view === 'ciclos' && <CyclesSection data={market} />}
          {view === 'oportunidad' && <SummarySection data={market} />}
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

function SecondaryHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <button type="button" onClick={onBack} className="liquid-action flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-secondary" aria-label="Volver a MÃ¡s">
        <ArrowLeft size={18} />
      </button>
      <h1 className="truncate text-lg font-extrabold text-primary sm:text-xl">{title}</h1>
    </div>
  );
}
