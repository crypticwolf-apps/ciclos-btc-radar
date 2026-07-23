import { lazy, Suspense } from 'react';
import type { CyclesSubview, MarketData } from '@/types';
import { CyclesSection } from '@/components/sections/CyclesSection';
import { SegmentedControl } from '@/components/ui/Controls';
import { Skeleton } from '@/components/ui/LoadingSkeleton';

// Altseason y Comparativa se cargan solo al abrirlas: no entran en el bundle
// inicial ni disparan sus peticiones si el usuario se queda en Ciclo BTC.
const AltseasonView = lazy(() =>
  import('@/components/altseason/AltseasonView').then((m) => ({ default: m.AltseasonView })),
);
const CyclesComparisonView = lazy(() =>
  import('@/components/views/CyclesComparisonView').then((m) => ({
    default: m.CyclesComparisonView,
  })),
);

// =============================================================================
// Pestaña CICLOS con sus tres subapartados.
//
// La navegación interna SUSTITUYE el contenido (no apila las tres secciones) y
// solo monta la vista activa, así que el DOM no acumula lo que no se está
// viendo. El control es un segmentado de 3 que cabe a 320 px sin recortarse y
// sin barra desplazable.
// =============================================================================

const SUBVIEWS: { value: CyclesSubview; label: string }[] = [
  { value: 'bitcoin', label: 'Ciclo BTC' },
  { value: 'altseason', label: 'Altseason' },
  { value: 'comparativa', label: 'Comparativa' },
];

interface CyclesViewProps {
  data: MarketData;
  sub: CyclesSubview;
  onSubChange: (sub: CyclesSubview) => void;
}

export function CyclesView({ data, sub, onSubChange }: CyclesViewProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <nav aria-label="Apartados de Ciclos">
        <SegmentedControl<CyclesSubview>
          size="sm"
          value={sub}
          onChange={onSubChange}
          options={SUBVIEWS}
          className="w-full [&>button]:min-h-11 [&>button]:flex-1 [&>button]:px-1 [&>button]:text-xs min-[380px]:[&>button]:text-sm"
        />
      </nav>

      {sub === 'bitcoin' && <CyclesSection data={data} />}

      {sub === 'altseason' && (
        <Suspense fallback={<Skeleton className="h-[520px]" />}>
          <AltseasonView />
        </Suspense>
      )}

      {sub === 'comparativa' && (
        <Suspense fallback={<Skeleton className="h-[420px]" />}>
          <CyclesComparisonView data={data} />
        </Suspense>
      )}
    </div>
  );
}
