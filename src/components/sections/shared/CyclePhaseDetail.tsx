import { AlertTriangle, Sparkles, Activity, History } from 'lucide-react';
import type { CyclePhase } from '@/types';

// Detalle de la fase del ciclo: descripción, señales, oportunidades, riesgos y
// comparación histórica.
//
// Es CONTENIDO, no una tarjeta: vive dentro del cuadro plegable «Fase actual:
// …», que ya trae su título y su chapa de fase. Cuando además se envolvía en su
// propia tarjeta, la pantalla enseñaba «Fase actual: Acumulación», debajo «¿En
// qué fase estamos?» y debajo otra vez la chapa «Acumulación»: tres formas de
// decir lo mismo antes de llegar al primer dato.
export function CyclePhaseDetail({ fase }: { fase: CyclePhase }) {
  return (
    <>
      {/* Por qué esta fase: el motivo y las cifras de ahora con las que se ha
          decidido. Cambian solas con los datos; si cambian lo bastante, cambia
          la fase entera (nombre, color y explicación). */}
      {fase.motivo && (
        <div
          className="mb-3 rounded-xl px-3 py-2.5"
          style={{ background: `${fase.color}12`, border: `1px solid ${fase.color}33` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: fase.color }}>
            Por qué esta fase
          </p>
          <p className="mt-1 text-xs leading-relaxed text-secondary">{fase.motivo}</p>
          {fase.criterios && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fase.criterios.map((c) => (
                <span
                  key={c.label}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted"
                >
                  {c.label} <strong className="font-mono text-secondary">{c.valor}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-sm leading-relaxed text-secondary">{fase.descripcion}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <PhaseList
          icon={<Activity size={14} />}
          color="#3b82f6"
          title="Señales típicas"
          items={fase.senales}
        />
        <PhaseList
          icon={<Sparkles size={14} />}
          color="#22c55e"
          title="Oportunidades"
          items={fase.oportunidades}
        />
        <PhaseList
          icon={<AlertTriangle size={14} />}
          color="#ef4444"
          title="Riesgos"
          items={fase.riesgos}
        />
      </div>

      <div
        className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed text-secondary"
        style={{ background: `${fase.color}12`, border: `1px solid ${fase.color}33` }}
      >
        <History size={15} className="mt-0.5 shrink-0" style={{ color: fase.color }} />
        <span>
          <span className="font-semibold" style={{ color: fase.color }}>
            Comparación histórica:{' '}
          </span>
          {fase.comparacionHistorica}
        </span>
      </div>
    </>
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
        {icon} {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5 text-[11px] leading-snug text-secondary">
            <span style={{ color }}>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
