import { lazy, Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import type { MarketData } from '@/types';
import { Card } from '@/components/ui/Card';
import { PrecioEnVivo } from '@/components/ui/PrecioEnVivo';
import { RuedaFase } from '@/components/ui/RuedaFase';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { DeferUntilVisible } from '@/components/ui/DeferUntilVisible';
import { Columnas, type ItemColumna } from '@/components/layout/Columnas';

// Las tarjetas de debajo de la del precio (Altseason con su cálculo en vivo, la
// temperatura y el miedo y codicia, con sus barras) se descargan al acercarse a
// pantalla, no en la carga inicial: lo primero que se ve abre antes.
const AltseasonHomeCard = lazy(() =>
  import('@/components/altseason/AltseasonHomeCard').then((m) => ({ default: m.AltseasonHomeCard })),
);
const OportunidadHomeCard = lazy(() =>
  import('@/components/views/OportunidadHomeCard').then((m) => ({ default: m.OportunidadHomeCard })),
);
const MiedoCodiciaHomeCard = lazy(() =>
  import('@/components/views/MiedoCodiciaHomeCard').then((m) => ({ default: m.MiedoCodiciaHomeCard })),
);

export function HomeView({
  data,
  onGoToScore,
  onGoToAltseason,
  onGoToPrice,
  onGoToPhase,
  onGoToFearGreed,
}: {
  data: MarketData;
  onGoToScore?: () => void;
  onGoToAltseason?: () => void;
  /** Al gráfico del precio, que vive en Ciclos → Ciclo BTC. */
  onGoToPrice?: () => void;
  /** A la tarjeta «Fase actual», al final de Ciclos → Ciclo BTC. */
  onGoToPhase?: () => void;
  /** A la tarjeta del índice de miedo y codicia, en Análisis. */
  onGoToFearGreed?: () => void;
}) {
  const heroe = (
    <Card className="liquid-hero !p-4 sm:!p-6" accent={data.fase.color}>
      {/* Precio en vivo, centrado: lo único que se redibuja con cada precio. */}
      <PrecioEnVivo data={data} />

      {/* Fase estimada del ciclo, en la rueda de fases. `memo`: no se redibuja
          con cada precio en vivo. */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="mb-1 text-center text-[11px] text-muted">Fase estimada del ciclo</p>
        <RuedaFase fase={data.fase} compact />
      </div>

      {/* Los dos accesos, uno al lado del otro */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {/* El gráfico del precio está en Ciclos → Ciclo BTC, el primero. */}
        <a
          href="?vista=ciclos"
          onClick={(event) => {
            event.preventDefault();
            onGoToPrice?.();
          }}
          className="liquid-action inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-center text-[13px] font-bold leading-tight text-secondary sm:gap-1.5 sm:text-sm"
        >
          Ver precio de Bitcoin
          <ArrowRight size={15} className="shrink-0" aria-hidden="true" />
        </a>
        {/* Y la fase, con sus señales, riesgos y oportunidades, al final de la misma pestaña. */}
        <a
          href="?vista=ciclos#fase-actual"
          onClick={(event) => {
            event.preventDefault();
            onGoToPhase?.();
          }}
          className="liquid-action inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-center text-[13px] font-bold leading-tight text-secondary sm:gap-1.5 sm:text-sm"
        >
          Ver fase del ciclo
          <ArrowRight size={15} className="shrink-0" aria-hidden="true" />
        </a>
      </div>
    </Card>
  );

  // Inicio del móvil. En escritorio no hay pestañas: todo va en una hoja
  // (views/HojaEscritorio), sin esta tarjeta ni los resúmenes, que repetirían
  // los cuadros completos.
  const items: ItemColumna[] = [{ clave: 'precio', nodo: heroe }];

  // Marcador de Altseason. Se monta al acercarse a pantalla para no meter otra
  // petición en la carga inicial; el análisis completo (señales, métricas y
  // ranking) vive en Ciclos → Altseason.
  if (onGoToAltseason) {
    items.push({
      clave: 'altseason',
      nodo: (
        <DeferUntilVisible minHeight={220} placeholder={<Skeleton className="h-[220px]" />}>
          <Suspense fallback={<Skeleton className="h-[220px]" />}>
            <AltseasonHomeCard onOpen={onGoToAltseason} />
          </Suspense>
        </DeferUntilVisible>
      ),
    });
  }

  // Temperatura del mercado, con su resumen; el desglose completo (bloques,
  // confianza e histórico) sigue en su pestaña.
  if (onGoToScore) {
    items.push({
      clave: 'temperatura',
      nodo: (
        <DeferUntilVisible minHeight={300} placeholder={<Skeleton className="h-[300px]" />}>
          <Suspense fallback={<Skeleton className="h-[300px]" />}>
            <OportunidadHomeCard opportunity={data.opportunity} onOpen={onGoToScore} />
          </Suspense>
        </DeferUntilVisible>
      ),
    });
  }

  // Miedo y codicia en la barra líquida, al final; el detalle (histórico y
  // mínimos) está en Análisis.
  if (data.indicators.fearGreed != null) {
    const valor = data.indicators.fearGreed;
    items.push({
      clave: 'miedo-codicia',
      nodo: (
        <DeferUntilVisible minHeight={240} placeholder={<Skeleton className="h-[240px]" />}>
          <Suspense fallback={<Skeleton className="h-[240px]" />}>
            <MiedoCodiciaHomeCard valor={valor} etiqueta={data.indicators.fearGreedLabel} onOpen={onGoToFearGreed} />
          </Suspense>
        </DeferUntilVisible>
      ),
    });
  }

  return <Columnas items={items} />;
}

