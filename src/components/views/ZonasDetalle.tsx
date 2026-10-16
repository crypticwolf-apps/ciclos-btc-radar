import { ChartNoAxesCombined, Repeat2, Thermometer } from 'lucide-react';
import type { MarketData } from '@/types';
import { Columnas, type ItemColumna } from '@/components/layout/Columnas';
import { Zona } from '@/components/layout/Zona';
import { DeferUntilVisible } from '@/components/ui/DeferUntilVisible';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { EnVista } from '@/components/ui/EnVista';
import { HalvingCountdown } from '@/components/ui/HalvingCountdown';
import { GraficoCiclosCard, HistoricoHalvingsCard } from '@/components/sections/CyclesSection';
import { SamePointCard } from '@/components/views/CyclesComparisonView';
import { CuadroAltseason } from '@/components/altseason/AltseasonView';
import { DesgloseCard, MotivosCard } from '@/components/sections/SummarySection';
import { ScoreHistoryCard } from '@/components/sections/ScoreHistoryCard';
import { MarketPressureCard } from '@/components/sections/MarketPressureCard';
import { LeverageCard } from '@/components/sections/LeverageCard';
import { NetworkCard } from '@/components/sections/NetworkCard';
import { DrawdownsSection } from '@/components/sections/DrawdownsSection';
import { RisingFloorSection } from '@/components/sections/RisingFloorSection';
import { SmartMoneySection } from '@/components/sections/SmartMoneySection';
import { RsiFearSection } from '@/components/sections/RsiFearSection';
import { OnchainSection } from '@/components/sections/OnchainSection';
import { MacroSection } from '@/components/sections/MacroSection';

// =============================================================================
// Las zonas de detalle de la hoja de escritorio (views/HojaEscritorio), cada
// una con los cuadros de su tema, sin repetir ninguno de los de arriba:
//
//   · Ciclos: el gráfico de los ciclos, el halving y su histórico, el ciclo
//     actual frente a los anteriores y el resto del Altseason (el ranking, a
//     todo el ancho, al final).
//   · Temperatura: qué la sube y qué la baja, su evolución, la fase día a día y
//     el desglose por bloques (a todo el ancho, en columnas).
//   · Análisis: todos los indicadores.
//
// Cada cuadro se monta al acercarse a pantalla (o a los pocos segundos), para
// que la hoja abra igual de rápido que abría Inicio.
// =============================================================================

export function ZonasDetalle({ data }: { data: MarketData }) {
  const hayMotivos = data.opportunity.suben.length > 0 || data.opportunity.bajan.length > 0;

  const ciclos: ItemColumna[] = [
    { clave: 'grafico', alto: 470, nodo: <GraficoCiclosCard data={data} /> },
    { clave: 'halving', alto: 280, nodo: <HalvingCountdown info={data.halvingInfo} /> },
    { clave: 'halvings', alto: 430, nodo: <HistoricoHalvingsCard data={data} /> },
    { clave: 'mismo-punto', alto: 380, ancla: 'zona-comparativa', nodo: <SamePointCard data={data} /> },
    { clave: 'senales-favor', alto: 260, ancla: 'zona-altseason', nodo: <CuadroAltseason parte="senales-favor" /> },
    { clave: 'senales-contra', alto: 260, nodo: <CuadroAltseason parte="senales-contra" /> },
    { clave: 'metricas', alto: 380, nodo: <CuadroAltseason parte="metricas" /> },
    { clave: 'categorias', alto: 900, nodo: <CuadroAltseason parte="categorias" /> },
    { clave: 'amplitud', alto: 560, nodo: <CuadroAltseason parte="amplitud" /> },
    { clave: 'componentes', alto: 600, nodo: <CuadroAltseason parte="componentes" /> },
    // Una tabla de nueve columnas: a todo el ancho y al final.
    { clave: 'ranking', alto: 940, ancho: true, alFinal: true, nodo: <CuadroAltseason parte="ranking" /> },
  ];

  const temperatura: ItemColumna[] = [
    ...(hayMotivos
      ? [
          { clave: 'reduce', alto: 260, nodo: <MotivosCard data={data} sentido="reduce" /> },
          { clave: 'aumenta', alto: 260, nodo: <MotivosCard data={data} sentido="aumenta" /> },
        ]
      : []),
    { clave: 'evolucion', alto: 420, nodo: <ScoreHistoryCard parte="temperatura" /> },
    { clave: 'fase-dia', alto: 560, nodo: <ScoreHistoryCard parte="fase" /> },
    // Los bloques, a todo el ancho y repartidos en columnas: en una sola, la
    // lista era la más larga de la hoja.
    { clave: 'desglose', alto: 600, ancho: true, alFinal: true, nodo: <DesgloseCard data={data} columnas /> },
  ];

  const analisis: ItemColumna[] = [
    // Con datos en vivo: solo los piden mientras se ven.
    { clave: 'presion', alto: 300, nodo: <EnVista>{(vivo) => <MarketPressureCard vivo={vivo} />}</EnVista> },
    { clave: 'apalancamiento', alto: 480, nodo: <EnVista>{(vivo) => <LeverageCard data={data} vivo={vivo} />}</EnVista> },
    { clave: 'red', alto: 320, nodo: <NetworkCard /> },
    { clave: 'caidas', alto: 700, nodo: <DrawdownsSection data={data} /> },
    { clave: 'suelo', alto: 580, nodo: <RisingFloorSection data={data} /> },
    { clave: 'divergencia', alto: 520, nodo: <SmartMoneySection data={data} /> },
    { clave: 'rsi', alto: 520, nodo: <RsiFearSection data={data} parte="rsi" /> },
    { clave: 'onchain', alto: 900, nodo: <OnchainSection /> },
    { clave: 'macro', alto: 760, nodo: <MacroSection data={data} parte="tablero" /> },
    { clave: 'liquidez', alto: 560, nodo: <MacroSection data={data} parte="liquidez" /> },
  ];

  return (
    <>
      <Zona id="ciclos" titulo="Ciclos" icono={Repeat2}>
        <Columnas items={diferir(ciclos)} />
      </Zona>
      <Zona id="temperatura" titulo="Temperatura" icono={Thermometer}>
        <Columnas items={diferir(temperatura)} />
      </Zona>
      <Zona id="analisis" titulo="Análisis" icono={ChartNoAxesCombined}>
        <Columnas items={diferir(analisis)} />
      </Zona>
    </>
  );
}

/** Cada cuadro, montado al acercarse a pantalla; mientras, su hueco aproximado. */
function diferir(items: ItemColumna[]): ItemColumna[] {
  return items.map((it) => ({
    ...it,
    nodo: (
      <DeferUntilVisible minHeight={it.alto ?? 300} placeholder={<Skeleton className="h-full min-h-[inherit]" />}>
        {it.nodo}
      </DeferUntilVisible>
    ),
  }));
}
