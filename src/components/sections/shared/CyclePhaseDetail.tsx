import { AlertTriangle, Sparkles, Activity, History } from 'lucide-react';
import type { CyclePhase } from '@/types';
import { Card } from '@/components/ui/Card';
import { CyclePhaseBadge } from '@/components/ui/CyclePhaseBadge';

interface CyclePhaseDetailProps {
  fase: CyclePhase;
  expanded?: boolean;
}

// Tarjeta de detalle de la fase del ciclo: descripción, señales, riesgos,
// oportunidades y comparación histórica.
export function CyclePhaseDetail({ fase, expanded = false }: CyclePhaseDetailProps) {
  return (
    <Card accent={fase.color}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-primary">¿En qué fase estamos?</h3>
        <CyclePhaseBadge fase={fase} />
      </div>
      <p className="text-sm leading-relaxed text-secondary">{fase.descripcion}</p>

      {expanded && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <PhaseList
            icon={<Activity size={15} />}
            color="#3b82f6"
            title="Señales típicas"
            items={fase.senales}
          />
          <PhaseList
            icon={<Sparkles size={15} />}
            color="#22c55e"
            title="Oportunidades"
            items={fase.oportunidades}
          />
          <PhaseList
            icon={<AlertTriangle size={15} />}
            color="#ef4444"
            title="Riesgos"
            items={fase.riesgos}
          />
        </div>
      )}

      <div
        className="mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-secondary"
        style={{ background: `${fase.color}12`, border: `1px solid ${fase.color}33` }}
      >
        <History size={16} className="mt-0.5 shrink-0" style={{ color: fase.color }} />
        <span>
          <span className="font-semibold" style={{ color: fase.color }}>
            Comparación histórica:{' '}
          </span>
          {fase.comparacionHistorica}
        </span>
      </div>
    </Card>
  );
}

function PhaseList({
  icon,
  color,
  title,
  items,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
        {icon} {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-relaxed text-secondary">
            <span style={{ color }}>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
