import { memo } from 'react';
import type { LivePrices, PollState } from '@/hooks/useRealtime';
import { useLiveAltseason } from '@/hooks/useLiveAltseason';
import { useEnVista } from '@/hooks/useEnVista';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { FreshnessTag } from '@/components/ui/FreshnessTag';
import { AltseasonGauge } from './AltseasonGauge';
import type { AltseasonResponse } from '@/types/altseason';
import { cx } from '@/lib/format';

// El marcador del Altseason Score, aparte del resto de la vista (que arrastra la
// librería de gráficos): en escritorio va arriba del todo, con lo esencial.

/**
 * El marcador por su cuenta, para la hoja de escritorio: se apunta a la misma
 * consulta que los demás cuadros y pide los precios en vivo solo mientras se ve.
 * `memo`: no depende del precio de Bitcoin en vivo.
 */
export const AltseasonResumen = memo(function AltseasonResumen() {
  const [ref, enVista] = useEnVista<HTMLDivElement>();
  const { query, data, prices } = useLiveAltseason(enVista);
  const meta = query.data?.meta.sources[0];

  return (
    <div ref={ref}>
      {query.isLoading ? (
        <Skeleton className="h-[420px]" />
      ) : query.isError ? (
        <ErrorState
          message={query.error?.message ?? 'No se pudo cargar el análisis de altseason.'}
          onRetry={() => query.refetch()}
        />
      ) : !data ? (
        <NoDisponible nota={meta?.note} />
      ) : (
        <SummaryCard data={data} status={meta?.status} live={prices} />
      )}
    </div>
  );
});

export function NoDisponible({ nota }: { nota?: string }) {
  return (
    <CollapsibleCard title="Altseason Score no disponible" titleClassName="text-primary">
      <p className="text-sm leading-relaxed text-secondary">
        No se han podido obtener los datos de mercado necesarios. La sección vuelve sola en
        cuanto el proveedor responda; no se muestra una puntuación inventada mientras tanto.
      </p>
      {nota && <p className="mt-2 text-xs text-muted">Detalle: {nota}</p>}
    </CollapsibleCard>
  );
}


// --- Resumen ----------------------------------------------------------------

export function SummaryCard({
  data,
  status,
  live,
}: {
  data: AltseasonResponse;
  status?: string;
  live: PollState<LivePrices>;
}) {
  const { result, metrics } = data;
  const enVivo = live.data != null && !live.stale;
  const unavailable = result.score == null;

  return (
    <CollapsibleCard
      title="Altseason Score"
      titleClassName="text-primary"
      info="Mide si el capital está rotando de Bitcoin hacia las altcoins. Se calcula con siete métricas reales ponderadas; no es la Temperatura del mercado ni una recomendación."
      badge={
        enVivo ? (
          <FreshnessTag
            freshness="actualizado"
            at={live.data!.at}
            source="Amplitud, dominancia, ETH/BTC y ranking con precio en vivo cada 5 s · volumen y stablecoins cada 30 min"
          />
        ) : (
          <FreshnessTag
            freshness={status === 'stale' || status === 'cached' ? 'cache' : 'actualizado'}
            at={data.observedAt}
            source="CoinGecko · exchange · DefiLlama"
          />
        )
      }
    >

      <AltseasonGauge
        score={result.score}
        classification={result.classification}
        phaseLabel={result.phaseLabel}
      />

      {unavailable && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm leading-relaxed text-secondary">
          {result.unavailableReason} No se muestra un 0: faltan datos, que no es lo mismo que una
          rotación nula.
        </p>
      )}

      {/* Lo que significa cada tramo y cada fase está en Ajustes → Información;
          aquí, solo el estado y cuánto fiarse de él. */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini
          label="Confianza"
          value={result.confidence}
          tone={
            result.confidence === 'alta' ? 'bull' : result.confidence === 'media' ? 'btc' : 'bear'
          }
        />
        <Mini label="Cobertura" value={`${result.coverage}%`} hint={`${result.componentsAvailable}/${result.componentsTotal} métricas`} />
        <Mini label="Analizadas" value={String(metrics.analyzedCount)} hint={`${data.excludedCount} excluidas`} />
      </div>
    </CollapsibleCard>
  );
}

function Mini({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'bull' | 'bear' | 'btc';
}) {
  const color =
    tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : tone === 'btc' ? 'text-btc' : 'text-primary';
  return (
    <div className="liquid-subcard min-w-0 rounded-xl p-2.5">
      <p className="truncate text-[10px] leading-tight text-muted">{label}</p>
      {/* Sin `truncate`: «Rotación temprana» no cabe en una línea a 390 px y se
          quedaba en «Rotación Tempr…». Mejor dos líneas que media palabra. */}
      <p className={cx('text-sm font-bold capitalize leading-tight', color)}>{value}</p>
      {hint && <p className="truncate text-[10px] leading-tight text-muted">{hint}</p>}
    </div>
  );
}

