import { ArrowRight } from 'lucide-react';
import type { OpportunityScore } from '@/types';
import { Card } from '@/components/ui/Card';
import { TermometroCristal } from '@/components/ui/TermometroCristal';
import { useScoreHistory } from '@/hooks/useScoreHistory';
import { snapshotHace } from '@/lib/score/snapshot';

// =============================================================================
// Inicio → Termómetro de oportunidad: el mismo termómetro de su pestaña, con el
// resumen del contexto y el acceso al desglose completo (bloques, confianza e
// histórico), que sigue viviendo en Oportunidad.
//
// Se monta al acercarse a pantalla (DeferUntilVisible en HomeView): la marca de
// hace 7 días necesita el histórico, y así no entra en la carga inicial.
// =============================================================================

export function OportunidadHomeCard({ opportunity, onOpen }: { opportunity: OpportunityScore; onOpen: () => void }) {
  // La misma consulta que la pestaña Oportunidad: si ya está, no se repite.
  const historial = useScoreHistory().data?.data;
  const hace7 = historial?.configured ? (snapshotHace(historial.days, 7)?.score ?? null) : null;

  return (
    <Card className="!p-4 sm:!p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-primary sm:text-base">Termómetro de oportunidad</h2>
        <span className="text-[11px] text-muted">Contexto de mercado</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-secondary">{opportunity.resumen}</p>

      <div className="mt-3 flex justify-center">
        <TermometroCristal opportunity={opportunity} hace7={hace7} />
      </div>

      <a
        href="?vista=oportunidad"
        onClick={(event) => {
          event.preventDefault();
          onOpen();
        }}
        className="liquid-action mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-secondary"
      >
        Ver termómetro de oportunidad
        <ArrowRight size={15} aria-hidden="true" />
      </a>
    </Card>
  );
}
