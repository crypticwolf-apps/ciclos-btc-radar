import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { CyclesSubview, MarketData } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { useMarketData } from '@/hooks/useMarketData';
import { destinoEscritorio, scrollToAnchor, useAppNavigation } from '@/hooks/useAppNavigation';
import { useCurrency } from '@/contexts/CurrencyContext';
import { TopBar } from '@/components/layout/TopBar';
import { Navigation, NavegacionEscritorio } from '@/components/layout/Navigation';
import { Columnas, useEsEscritorio } from '@/components/layout/Columnas';
import { HomeView } from '@/components/views/HomeView';
import { SettingsView } from '@/components/views/SettingsView';
import { DashboardSkeleton, Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { cx, timeAgo } from '@/lib/format';

const CyclesView = lazy(() => import('@/components/views/CyclesView').then((module) => ({ default: module.CyclesView })));
const SummarySection = lazy(() => import('@/components/sections/SummarySection').then((module) => ({ default: module.SummarySection })));
const AnalysisView = lazy(() => import('@/components/views/AnalysisView').then((module) => ({ default: module.AnalysisView })));
// Información es texto: mucho contenido que casi nunca se abre. Fuera del
// paquete inicial.
const InfoView = lazy(() => import('@/components/views/InfoView').then((module) => ({ default: module.InfoView })));
const DeveloperCard = lazy(() => import('@/components/views/DeveloperCard').then((module) => ({ default: module.DeveloperCard })));
// Las alertas solo se ven en Ajustes: también aparte.
const AlertsCard = lazy(() => import('@/components/views/AlertsCard').then((module) => ({ default: module.AlertsCard })));
// Escritorio: el panel de Ajustes, solo cuando se abre por primera vez.
const PanelAjustes = lazy(() => import('@/components/layout/PanelAjustes').then((module) => ({ default: module.PanelAjustes })));
// Escritorio: todo en una hoja (no entra en el paquete del móvil).
const HojaEscritorio = lazy(() => import('@/components/views/HojaEscritorio').then((module) => ({ default: module.HojaEscritorio })));

export default function App() {
  const { theme, toggle } = useTheme();
  const { data, loading, refreshing, error, lastUpdated, guardado, refresh } = useMarketData();
  const { syncExchangeRate } = useCurrency();
  const navigation = useAppNavigation();
  // Desde 1024 px no hay pestañas: todo va en una hoja y Ajustes, en un panel.
  const escritorio = useEsEscritorio();
  const [panelAjustes, setPanelAjustes] = useState(() => navigation.view === 'ajustes');
  // El panel se descarga y se monta la primera vez que se abre, y luego se queda.
  const [panelVisto, setPanelVisto] = useState(panelAjustes);
  if (panelAjustes && !panelVisto) setPanelVisto(true);
  const abrirAjustes = useCallback(() => setPanelAjustes(true), []);
  const cerrarAjustes = useCallback(() => {
    setPanelAjustes(false);
    // Si se entró por un enlace a Ajustes, al cerrar la dirección ya no lo dice.
    const url = new URL(window.location.href);
    if (url.searchParams.get('vista') === 'ajustes') {
      url.searchParams.delete('vista');
      window.history.replaceState(window.history.state, '', url);
    }
  }, []);

  useEffect(() => {
    syncExchangeRate(data?.usdToEur);
  }, [data?.usdToEur, syncExchangeRate]);

  // En escritorio, un enlace a una pestaña (compartido, de un aviso…) baja a su
  // zona de la hoja; uno a Ajustes abre el panel.
  useEffect(() => {
    if (!escritorio) return;
    if (navigation.view === 'ajustes') setPanelAjustes(true);
    const destino = destinoEscritorio(navigation.view, navigation.sub, window.location.hash);
    if (destino) scrollToAnchor(destino);
    // Solo al abrir (o al pasar a escritorio), no en cada cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escritorio]);

  return (
    <div className="app-shell min-h-screen overflow-x-clip">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <TopBar
        source={data?.source ?? 'stale'}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        error={error}
        sinConexion={guardado?.sinConexion ?? false}
        onRefresh={refresh}
        navegacion={escritorio ? <NavegacionEscritorio panelAbierto={panelAjustes} onAjustes={abrirAjustes} /> : undefined}
      />

      {/* En escritorio, todo el ancho del monitor: una sola hoja con los
          cuadros en columnas (views/HojaEscritorio, layout/Columnas). */}
      <main className="relative z-10 mx-auto max-w-7xl px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pt-5 lg:max-w-none lg:px-6 lg:pb-8 lg:pt-4 2xl:px-8">
        <Navigation active={navigation.view} onChange={navigation.goTo} />
        {guardado && (guardado.sinConexion || refreshing) && (
          <SavedDataNotice desde={guardado.desde} sinConexion={guardado.sinConexion} onRetry={refresh} />
        )}
        <div id="view-content" className="min-w-0 scroll-mt-3 lg:scroll-mt-20">
          {/* Si una pestaña falla al cargar o al dibujarse, aviso con «Recargar» en
              vez de pantalla en blanco; al cambiar de pestaña se vuelve a intentar. */}
          <ErrorBoundary resetKey={`${navigation.view}/${navigation.sub}`}>
            <Suspense fallback={<Skeleton className="h-[420px]" />}>
              {escritorio ? (
                <DataGate data={data} loading={loading} error={error} onRetry={refresh}>
                  {(market) => <HojaEscritorio data={market} />}
                </DataGate>
              ) : (
                <CurrentView
                  view={navigation.view}
                  data={data}
                  loading={loading}
                  error={error}
                  onRefresh={refresh}
                  onGoToScore={() => navigation.goTo('temperatura')}
                  sub={navigation.sub}
                  onSubChange={navigation.goToSub}
                  onGoToAltseason={() => navigation.goTo('ciclos', 'altseason')}
                  onGoToPrice={() => navigation.goTo('ciclos', 'bitcoin')}
                  onGoToPhase={() => navigation.goTo('ciclos', 'bitcoin', 'fase-actual')}
                  onGoToFearGreed={() => navigation.goTo('analisis', 'bitcoin', 'miedo-codicia')}
                  ajustes={<CuadrosAjustes theme={theme} onToggleTheme={toggle} refreshing={refreshing} onRefresh={refresh} />}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {escritorio && panelVisto && (
        <Suspense fallback={null}>
          <PanelAjustes abierto={panelAjustes} onCerrar={cerrarAjustes}>
            <CuadrosAjustes theme={theme} onToggleTheme={toggle} refreshing={refreshing} onRefresh={refresh} enPanel />
          </PanelAjustes>
        </Suspense>
      )}
    </div>
  );
}

/**
 * Los cuadros de Ajustes, en el orden del móvil: en su pestaña allí, y en
 * escritorio dentro del panel que se abre desde el menú.
 */
function CuadrosAjustes({
  theme,
  onToggleTheme,
  refreshing,
  onRefresh,
  enPanel = false,
}: {
  theme: ReturnType<typeof useTheme>['theme'];
  onToggleTheme: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  enPanel?: boolean;
}) {
  const items: { clave: string; nodo: ReactNode }[] = [
    { clave: 'ajustes', nodo: <SettingsView theme={theme} onToggleTheme={onToggleTheme} refreshing={refreshing} onRefresh={onRefresh} /> },
    { clave: 'alertas', nodo: <AlertsCard /> },
    { clave: 'informacion', nodo: <InfoView /> },
    { clave: 'desarrollador', nodo: <DeveloperCard /> },
  ];
  if (!enPanel) return <Columnas items={items} />;
  return (
    <Suspense fallback={<Skeleton className="h-[240px]" />}>
      {items.map((it) => (
        <div key={it.clave} className="min-w-0">
          {it.nodo}
        </div>
      ))}
    </Suspense>
  );
}

function CurrentView({
  view,
  data,
  loading,
  error,
  onRefresh,
  onGoToScore,
  sub,
  onSubChange,
  onGoToAltseason,
  onGoToPrice,
  onGoToPhase,
  onGoToFearGreed,
  ajustes,
}: {
  view: ReturnType<typeof useAppNavigation>['view'];
  data: MarketData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onGoToScore: () => void;
  sub: CyclesSubview;
  onSubChange: (sub: CyclesSubview) => void;
  onGoToAltseason: () => void;
  onGoToPrice: () => void;
  onGoToPhase: () => void;
  onGoToFearGreed: () => void;
  /** Los cuadros de Ajustes (`CuadrosAjustes`). */
  ajustes: ReactNode;
}) {
  if (view === 'ajustes') return ajustes;

  return (
    <DataGate data={data} loading={loading} error={error} onRetry={onRefresh}>
      {(market) => (
        <>
          {view === 'inicio' && (
            <div className="space-y-3 sm:space-y-4">
              <HomeView
                data={market}
                onGoToScore={onGoToScore}
                onGoToAltseason={onGoToAltseason}
                onGoToPrice={onGoToPrice}
                onGoToPhase={onGoToPhase}
                onGoToFearGreed={onGoToFearGreed}
              />
            </div>
          )}
          {view === 'ciclos' && (
            <CyclesView data={market} sub={sub} onSubChange={onSubChange} />
          )}
          {view === 'temperatura' && <SummarySection data={market} />}
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

/** Aviso de que lo que se ve son los datos guardados del último uso. */
function SavedDataNotice({ desde, sinConexion, onRetry }: { desde: Date; sinConexion: boolean; onRetry: () => void }) {
  return (
    <p
      role="status"
      className={cx(
        'mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-xs',
        sinConexion ? 'border-bear/30 bg-bear/5 text-secondary' : 'border-white/10 bg-white/5 text-muted',
      )}
    >
      {sinConexion
        ? `Sin conexión: estás viendo los datos guardados (${timeAgo(desde)}).`
        : `Datos guardados (${timeAgo(desde)}) · actualizando…`}
      {sinConexion && (
        <button type="button" onClick={onRetry} className="font-semibold text-btc underline-offset-2 hover:underline">
          Reintentar
        </button>
      )}
    </p>
  );
}
