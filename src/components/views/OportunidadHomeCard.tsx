import { ArrowRight } from 'lucide-react';
import type { OpportunityScore } from '@/types';
import { Card } from '@/components/ui/Card';
import { TermometroCristal } from '@/components/ui/TermometroCristal';
import { useScoreHistory } from '@/hooks/useScoreHistory';
import { snapshotHace } from '@/lib/score/snapshot';

// =============================================================================
// Inicio → Temperatura del mercado: el mismo termómetro de su pestaña, con el
// resumen del contexto y el acceso al desglose completo (bloques, confianza e
// histórico), que sigue viviendo en la pestaña Temperatura.
//
// Se monta al acercarse a pantalla (DeferUntilVisible en HomeView): la marca de
// hace 7 días necesita el histórico, y así no entra en la carga inicial.
// =============================================================================

export function OportunidadHomeCard({ opportunity, onOpen }: { opportunity: OpportunityScore; onOpen: () => void }) {
  // La misma consulta que la pestaña Temperatura: si ya está, no se repite.
  const historial = useScoreHistory().data?.data;
  const hace7 = historial?.configured ? (snapshotHace(historial.days, 7)?.score ?? null) : null;

  return (
    <Card className="!p-4 sm:!p-5">
      {/* Título y, debajo, qué se mide: igual en las tres tarjetas de Inicio
          (al lado no cabía siempre y esta bajaba de línea sola). */}
      <h2 className="text-sm font-bold text-primary sm:text-base">Temperatura del mercado</h2>
      <p className="mt-0.5 text-[11px] text-muted">Frío = oportunidad · Caliente = riesgo</p>

      <p className="mt-2 text-sm leading-relaxed text-secondary">{opportunity.resumen}</p>

      <div className="mt-3 flex justify-center">
        <TermometroCristal opportunity={opportunity} hace7={hace7} />
      </div>

      <a
        href="?vista=temperatura"
        onClick={(event) => {
          event.preventDefault();
          onOpen();
        }}
        className="liquid-action mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-secondary"
      >
        Ver temperatura del mercado
        <ArrowRight size={15} aria-hidden="true" />
      </a>
    </Card>
  );
}
