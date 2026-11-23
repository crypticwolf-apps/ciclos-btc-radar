import type { ReactNode } from 'react';
import { ChartNoAxesCombined, Coins, Repeat2, Thermometer } from 'lucide-react';
import type { MarketData } from '@/types';
import { Columnas, type ItemColumna } from '@/components/layout/Columnas';
import { Zona } from '@/components/layout/Zona';
import { DeferUntilVisible } from '@/components/ui/DeferUntilVisible';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { EnVista } from '@/components/ui/EnVista';
import { HalvingCountdown } from '@/components/ui/HalvingCountdown';
import { GraficoCiclosCard, HistoricoHalvingsCard } from '@/components/sections/CyclesSection';
import { DondeEstaCadaCicloCard, SamePointCard } from '@/components/views/CyclesComparisonView';
import { PriceChartCard } from '@/components/sections/PriceChartCard';
import { PrecioEnVivo } from '@/components/ui/PrecioEnVivo';
import { FaseActualCard } from '@/components/sections/FaseActualCard';
import { TermometroCard } from '@/components/sections/TermometroCard';
import { MiedoCodiciaCard } from '@/components/sections/MiedoCodiciaCard';
import { AltseasonResumen } from '@/components/altseason/AltseasonResumenCard';
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
// Las zonas de la hoja de escritorio (views/HojaEscritorio): cada cuadro en su
// sitio, el mismo que en las pestañas del móvil, y una sola vez.
//
//   · Ciclos, en dos bloques seguidos, cada uno cuadrado por su cuenta:
//       – el ciclo de Bitcoin: el precio en vivo con su gráfico, los ciclos, el
//         halving y su histórico, la fase actual y la comparativa de ciclos;
//       – el Altseason, con su título, y el ranking de altcoins a todo el ancho
//         al final.
//     Antes iban en un solo reparto y el cuadrado mezclaba los dos: arriba, al
//     lado del precio, salían cuadros del Altseason antes que su marcador.
//   · Temperatura: el termómetro, qué la sube y qué la baja, su evolución, la
//     fase día a día y el desglose por bloques (a todo el ancho, en columnas).
//   · Análisis: todos los indicadores, con el miedo y codicia.
//
// Cada cuadro se monta al acercarse a pantalla (o a los pocos segundos), para
// que la hoja abra rápido. `alto` es lo que mide cada uno en escritorio: su hueco
// de espera ocupa lo mismo y al montarse no empuja a los de debajo. `grafico`,
// el alto de su gráfico, que crece si hay que alargar el cuadro para cuadrar.
// =============================================================================

export function ZonasDetalle({ data }: { data: MarketData }) {
  const hayMotivos = data.opportunity.suben.length > 0 || data.opportunity.bajan.length > 0;

  const bitcoin: ItemColumna[] = [
    { clave: 'precio', alto: 710, grafico: 320, nodo: <PriceChartCard cabecera={<PrecioEnVivo data={data} />} /> },
    { clave: 'grafico', alto: 528, grafico: 320, nodo: <GraficoCiclosCard data={data} /> },
    { clave: 'halving', alto: 248, nodo: <HalvingCountdown info={data.halvingInfo} /> },
    { clave: 'halvings', alto: 520, nodo: <HistoricoHalvingsCard data={data} /> },
    { clave: 'fase', alto: 790, grafico: 260, nodo: <FaseActualCard fase={data.fase} /> },
    {
      clave: 'donde',
      alto: 342,
      ancla: 'zona-comparativa',
      nodo: <EnVista>{(visible) => <DondeEstaCadaCicloCard data={data} vivo={visible} />}</EnVista>,
    },
    { clave: 'mismo-punto', alto: 419, nodo: <SamePointCard data={data} /> },
  ];

  const altseason: ItemColumna[] = [
    { clave: 'altseason', alto: 404, grafico: 200, nodo: <AltseasonResumen /> },
    { clave: 'senales-favor', alto: 206, nodo: <CuadroAltseason parte="senales-favor" /> },
    { clave: 'senales-contra', alto: 230, nodo: <CuadroAltseason parte="senales-contra" /> },
    { clave: 'metricas', alto: 330, nodo: <CuadroAltseason parte="metricas" /> },
    { clave: 'categorias', alto: 886, nodo: <CuadroAltseason parte="categorias" /> },
    { clave: 'amplitud', alto: 570, grafico: 256, nodo: <CuadroAltseason parte="amplitud" /> },
    { clave: 'componentes', alto: 590, nodo: <CuadroAltseason parte="componentes" /> },
    // Una tabla de nueve columnas: a todo el ancho y al final.
    { clave: 'ranking', alto: 937, ancho: true, alFinal: true, nodo: <CuadroAltseason parte="ranking" /> },
  ];

  const temperatura: ItemColumna[] = [
    { clave: 'termometro', alto: 513, grafico: 300, nodo: <TermometroCard data={data} /> },
    ...(hayMotivos
      ? [
          { clave: 'reduce', alto: 240, nodo: <MotivosCard data={data} sentido="reduce" /> },
          { clave: 'aumenta', alto: 160, nodo: <MotivosCard data={data} sentido="aumenta" /> },
        ]
      : []),
    { clave: 'evolucion', alto: 414, grafico: 240, nodo: <ScoreHistoryCard parte="temperatura" /> },
    { clave: 'fase-dia', alto: 550, grafico: 208, nodo: <ScoreHistoryCard parte="fase" /> },
    // Los bloques, a todo el ancho y repartidos en columnas: en una sola, la
    // lista era la más larga de la hoja.
    { clave: 'desglose', alto: 470, ancho: true, alFinal: true, nodo: <DesgloseCard data={data} columnas /> },
  ];

  const analisis: ItemColumna[] = [
    // Con datos en vivo: solo los piden mientras se ven.
    { clave: 'presion', alto: 251, nodo: <EnVista>{(vivo) => <MarketPressureCard vivo={vivo} />}</EnVista> },
    { clave: 'apalancamiento', alto: 425, nodo: <EnVista>{(vivo) => <LeverageCard data={data} vivo={vivo} />}</EnVista> },
    { clave: 'red', alto: 274, nodo: <NetworkCard /> },
    { clave: 'caidas', alto: 685, grafico: 320, nodo: <DrawdownsSection data={data} /> },
    { clave: 'suelo', alto: 519, grafico: 320, nodo: <RisingFloorSection data={data} /> },
    { clave: 'divergencia', alto: 500, grafico: 256, nodo: <SmartMoneySection data={data} /> },
    { clave: 'rsi', alto: 483, grafico: 256, nodo: <RsiFearSection data={data} parte="rsi" /> },
    { clave: 'miedo', alto: 483, nodo: <MiedoCodiciaCard data={data} /> },
    { clave: 'onchain', alto: 860, nodo: <OnchainSection /> },
    { clave: 'macro', alto: 805, nodo: <MacroSection data={data} parte="tablero" /> },
    { clave: 'liquidez', alto: 539, grafico: 320, nodo: <MacroSection data={data} parte="liquidez" /> },
  ];

  return (
    <>
      <Zona id="ciclos" titulo="Ciclos" icono={Repeat2}>
        <Columnas items={diferir(bitcoin)} />
        <Bloque id="zona-altseason" titulo="Altseason">
          <Columnas items={diferir(altseason)} />
        </Bloque>
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

/**
 * Un bloque dentro de una zona, con un título aún más fino que el de la zona.
 * Un `div` y no una sección: los cuadros siguen siendo de su zona.
 */
function Bloque({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <div id={id} className="mt-6 scroll-mt-20">
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        <Coins size={13} strokeWidth={2.5} className="text-btc" aria-hidden="true" />
        {titulo}
        <span className="h-px flex-1 bg-gradient-to-r from-orange-400/35 via-orange-400/10 to-transparent" aria-hidden="true" />
      </h3>
      {children}
    </div>
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
