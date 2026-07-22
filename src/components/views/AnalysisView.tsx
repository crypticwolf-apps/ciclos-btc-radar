import { ChevronDown } from 'lucide-react';
import type { MarketData } from '@/types';
import { Card } from '@/components/ui/Card';
import { DrawdownsSection } from '@/components/sections/DrawdownsSection';
import { RisingFloorSection } from '@/components/sections/RisingFloorSection';
import { SmartMoneySection } from '@/components/sections/SmartMoneySection';
import { RsiFearSection } from '@/components/sections/RsiFearSection';
import { OnchainSection } from '@/components/sections/OnchainSection';
import { MacroSection } from '@/components/sections/MacroSection';

export function AnalysisView({ data }: { data: MarketData }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="!p-4 sm:!p-5">
        <h1 className="text-xl font-extrabold text-primary sm:text-2xl">Análisis completo</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-secondary">
          Todos los indicadores están desplegados. Puedes plegar cada bloque de forma independiente para centrarte en lo que necesites.
        </p>
      </Card>

      <AnalysisPanel title="Caídas y recuperaciones" subtitle="Profundidad de las correcciones y comportamiento posterior">
        <DrawdownsSection data={data} />
      </AnalysisPanel>
      <AnalysisPanel title="Suelo ascendente" subtitle="Evolución histórica de los mínimos anuales">
        <RisingFloorSection data={data} />
      </AnalysisPanel>
      <AnalysisPanel title="Smart money" subtitle="Actividad relativa de grandes inversores y minoristas">
        <SmartMoneySection data={data} />
      </AnalysisPanel>
      <AnalysisPanel title="RSI y miedo" subtitle="Momentum y sentimiento en zonas extremas">
        <RsiFearSection data={data} />
      </AnalysisPanel>
      <AnalysisPanel title="Datos on-chain" subtitle="Estado y actividad de la red Bitcoin">
        <OnchainSection />
      </AnalysisPanel>
      <AnalysisPanel title="Ciclo macroeconómico" subtitle="Liquidez, actividad económica y entorno monetario">
        <MacroSection data={data} />
      </AnalysisPanel>
    </div>
  );
}

function AnalysisPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <details className="group" open>
      <summary className="glass-strong liquid-action flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 marker:hidden sm:px-5">
        <span className="min-w-0">
          <span className="block text-base font-extrabold text-primary sm:text-lg">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted sm:text-sm">{subtitle}</span>
        </span>
        <ChevronDown size={20} className="shrink-0 text-btc transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-2 sm:mt-3">{children}</div>
    </details>
  );
}

