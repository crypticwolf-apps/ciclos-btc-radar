import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useLiveAltseason } from '@/hooks/useLiveAltseason';
import { useEnVista } from '@/hooks/useEnVista';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { AltseasonGauge } from './AltseasonGauge';

// =============================================================================
// Altseason en la pantalla de INICIO: el marcador y poco más.
//
// Enseña el número, su zona y la fase, que es lo que se mira de un vistazo. El
// análisis completo —señales, métricas, gráfico de amplitud y ranking— sigue
// viviendo en Ciclos → Altseason, y aquí solo hay un acceso.
//
// Si la fuente no responde no se ocupa sitio en la pantalla de inicio: el
// apartado de Ciclos ya explica allí por qué falta el dato.
// =============================================================================

// `memo`: la pantalla de inicio se redibuja con cada precio de Bitcoin en vivo,
// y este marcador no depende de él.
export const AltseasonHomeCard = memo(function AltseasonHomeCard({ onOpen }: { onOpen: () => void }) {
  // Precios en vivo solo mientras el marcador está a la vista.
  const [ref, enVista] = useEnVista<HTMLDivElement>();
  const { query, data } = useLiveAltseason(enVista);
  const result = data?.result;

  // El contenedor existe siempre, también cargando, para que el observador de
  // visibilidad tenga algo que mirar desde el primer momento.
  if (query.isLoading) return <div ref={ref}><Skeleton className="h-[220px]" /></div>;
  if (!result) return <div ref={ref} />;

  return (
    <div ref={ref}>
      <Card className="!p-4 sm:!p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-primary sm:text-base">Altseason</h2>
          <span className="text-[11px] text-muted">{result.phaseLabel}</span>
        </div>

        <div className="mt-3">
          <AltseasonGauge
            compact
            score={result.score}
            classification={result.classification}
            phaseLabel={result.phaseLabel}
          />
        </div>

        <a
          href="?vista=ciclos&sub=altseason"
          onClick={(event) => {
            event.preventDefault();
            onOpen();
          }}
          className="liquid-action mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-secondary"
        >
          Ver análisis de altcoins
          <ArrowRight size={15} aria-hidden="true" />
        </a>
      </Card>
    </div>
  );
});
