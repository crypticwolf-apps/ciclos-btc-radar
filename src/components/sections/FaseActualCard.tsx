import type { CyclePhase } from '@/types';
import { CollapsibleCard } from '@/components/ui/Collapsible';
import { CyclePhaseBadge } from '@/components/ui/CyclePhaseBadge';
import { RuedaFase } from '@/components/ui/RuedaFase';
import { CyclePhaseDetail } from './shared/CyclePhaseDetail';

/**
 * «Fase actual»: la rueda de fases y, debajo, sus señales, oportunidades y
 * riesgos. En el móvil va en Ciclos → Ciclo BTC; en escritorio, arriba del todo.
 * Con id: el botón «Ver fase del ciclo» de Inicio lleva directo aquí.
 */
export function FaseActualCard({ fase }: { fase: CyclePhase }) {
  return (
    <CollapsibleCard
      id="fase-actual"
      titleClassName="text-primary"
      title="Fase actual"
      subtitle="Señales, oportunidades y riesgos de esta fase"
      badge={<CyclePhaseBadge fase={fase} />}
    >
      <div className="mb-4">
        <RuedaFase fase={fase} />
      </div>
      <CyclePhaseDetail fase={fase} />
    </CollapsibleCard>
  );
}
