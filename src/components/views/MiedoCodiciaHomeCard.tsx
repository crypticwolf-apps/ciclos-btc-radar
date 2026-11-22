import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { BarraMiedoCodicia } from '@/components/ui/BarraMiedoCodicia';
import { ZONAS_MIEDO_CODICIA, zonaMiedoCodicia } from '@/lib/sentiment/miedoCodicia';

// =============================================================================
// Inicio → Miedo y codicia: la barra líquida del índice y un acceso a su
// tarjeta en Análisis (histórico frente a los mínimos de otros ciclos).
// =============================================================================

// `memo`: la pantalla de inicio se redibuja con cada precio de Bitcoin en vivo,
// y esta tarjeta no depende de él.
export const MiedoCodiciaHomeCard = memo(function MiedoCodiciaHomeCard({
  valor,
  etiqueta,
  onOpen,
}: {
  valor: number;
  etiqueta: string | null;
  onOpen?: () => void;
}) {
  return (
    <Card className="!p-4 sm:!p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-primary sm:text-base">Miedo y codicia</h2>
        <span className="text-[11px] text-muted">Sentimiento del mercado</span>
      </div>

      {/* Una frase con lo que significa, como en las otras tarjetas de Inicio. */}
      <p className="mt-2 text-sm leading-relaxed text-secondary">{ZONAS_MIEDO_CODICIA[zonaMiedoCodicia(valor, etiqueta)]!.resumen}</p>

      <div className="mt-3">
        <BarraMiedoCodicia valor={valor} etiqueta={etiqueta} compact />
      </div>

      {onOpen && (
        <a
          href="?vista=analisis#miedo-codicia"
          onClick={(event) => {
            event.preventDefault();
            onOpen();
          }}
          className="liquid-action mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-secondary"
        >
          Ver sentimiento del mercado
          <ArrowRight size={15} aria-hidden="true" />
        </a>
      )}
    </Card>
  );
});
