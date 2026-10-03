import { useState, type ReactNode, useEffect } from 'react';
import { ChevronDown, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { collapsiblePreference, subscribeCollapsibles } from '@/lib/collapseAll';
import { FreshnessTag, type Freshness } from '@/components/ui/FreshnessTag';
import { CLASSIFICATIONS, PHASES as ALT_PHASES, describeMethodology } from '@/lib/altseason/config';
import { PHASES as BTC_PHASES } from '@/data/phases';

// =============================================================================
// Ajustes → INFORMACIÓN: todo lo que se explica, en un solo sitio.
//
// Antes cada tarjeta arrastraba su propio párrafo de metodología, su línea de
// «Fuente: …» y su descargo. Eran textos que no cambian nunca compitiendo por
// el sitio con los números, que sí cambian. Aquí están juntos y allí quedan
// solo los datos.
//
// Lo que NO se ha movido, a propósito:
//   · la etiqueta de frescura y la línea de procedencia de cada tarjeta, porque
//     dicen qué proveedor respondió ESTA vez y cuándo: eso es dato, no texto;
//   · los iconos de ayuda (ⓘ) junto a cada métrica, que caben sin ocupar sitio
//     y explican el número que se está mirando sin salir de la pantalla.
// =============================================================================

const FRESHNESS: { state: Freshness; meaning: string }[] = [
  { state: 'vivo', meaning: 'Canal abierto: el número cambia solo, al instante.' },
  { state: 'actualizado', meaning: 'Consulta reciente a una fuente que cambia a menudo.' },
  { state: 'retrasado', meaning: 'La fuente va lenta; se muestra el último dato válido.' },
  { state: 'diario', meaning: 'La fuente publica una vez al día. Es su ritmo real, no un retraso.' },
  { state: 'cache', meaning: 'La API falla y se enseña el último dato bueno, con su fecha.' },
  { state: 'no-disponible', meaning: 'No hay dato. No se inventa ninguno ni se sustituye por un cero.' },
];

const GLOSSARY: { term: string; definition: string }[] = [
  {
    term: 'Fase del ciclo',
    definition:
      'Etiqueta estimada (acumulación, expansión, euforia, corrección…) a partir del precio, la caída desde máximos, el momento del halving y las métricas on-chain. Es una lectura del contexto, no una predicción.',
  },
  {
    term: 'Suelo del ciclo',
    definition:
      'Mínimo del mercado bajista PREVIO a un halving: el fondo desde el que arranca el ciclo. Se mide entre el techo anterior y el halving, porque desde el halving anterior el precio solo subió.',
  },
  {
    term: 'Techo del ciclo',
    definition:
      'Máximo en los 18 meses POSTERIORES al halving. La ventana se acota a propósito: sin ella, el ciclo de 2020 se quedaría con el rally de 2024, que ya pertenece al ciclo siguiente.',
  },
  {
    term: 'Caída desde máximos (drawdown)',
    definition: 'Distancia en porcentaje entre el precio actual y el máximo histórico.',
  },
  {
    term: 'RSI',
    definition:
      'Fuerza relativa del movimiento reciente, de 0 a 100. Por debajo de 30 se considera sobrevendido y por encima de 70 sobrecomprado; en tendencias fuertes puede quedarse en un extremo mucho tiempo.',
  },
  {
    term: 'Miedo y codicia',
    definition:
      'Índice de sentimiento del mercado de 0 (pánico) a 100 (euforia). Se publica una vez al día.',
  },
  {
    term: 'MVRV',
    definition:
      'Capitalización de mercado dividida entre la capitalización realizada (lo que costó de media cada moneda la última vez que se movió). Por encima de 3 el mercado acumula mucha ganancia latente; por debajo de 1 cotiza bajo su coste medio.',
  },
  {
    term: 'NUPL',
    definition:
      'Beneficio no realizado del conjunto del mercado, derivado del MVRV por identidad matemática (1 − 1/MVRV). No es una estimación aparte.',
  },
  {
    term: 'Puell Multiple',
    definition:
      'Ingresos diarios de los mineros frente a su media de un año. Muy bajo indica mineros exprimidos (suelos históricos); muy alto, emisión muy rentable.',
  },
  {
    term: 'Liquidez en stablecoins',
    definition:
      'Capitalización total de las stablecoins ancladas al dólar. Es la munición disponible para comprar sin traer dinero nuevo de fuera.',
  },
  {
    term: 'Funding',
    definition:
      'Pago periódico entre largos y cortos en los futuros perpetuos. Positivo y alto significa que mantener largos cuesta caro: hay apalancamiento comprador acumulado.',
  },
  {
    term: 'Interés abierto',
    definition:
      'Contratos de futuros vivos. Sube cuando entra apalancamiento nuevo y cae de golpe cuando se liquida.',
  },
  {
    term: 'Liquidaciones',
    definition:
      'Cierres forzosos de posiciones apalancadas. Una cascada de liquidaciones amplifica el movimiento que la provocó.',
  },
  {
    term: 'Presión del libro',
    definition:
      'Equilibrio entre el volumen de órdenes de compra y de venta visibles en los mejores niveles del libro. Es una foto del momento, no una previsión.',
  },
  {
    term: 'Mempool',
    definition:
      'Transacciones esperando confirmación. Cuanto más llena, más caro entrar en el próximo bloque.',
  },
  {
    term: 'Hashrate y dificultad',
    definition:
      'Potencia de cálculo que protege la red y el ajuste que hace el protocolo cada 2.016 bloques para mantener un bloque cada diez minutos.',
  },
  {
    term: 'Dominancia de Bitcoin',
    definition:
      'Porcentaje de la capitalización total del mercado cripto que representa Bitcoin. Si baja mientras el mercado sube, el capital está rotando hacia altcoins.',
  },
  {
    term: 'ETH/BTC',
    definition:
      'Precio de Ethereum medido en bitcoins. Mide la rotación sin el ruido del dólar: sube cuando las altcoins ganan terreno.',
  },
  {
    term: 'Importes en euros',
    definition:
      'Los precios históricos se convierten al cambio EUR/USD actual, no al de su fecha. En dólares son el dato original; en euros, una equivalencia de hoy.',
  },
  {
    term: 'Amplitud',
    definition:
      'Cuántas altcoins acompañan al movimiento (las que superan a Bitcoin, las que están sobre su media móvil). Una subida con amplitud baja la sostienen muy pocas monedas.',
  },
];

const SOURCES: { block: string; detail: string }[] = [
  {
    block: 'Precio, mercado global e histórico',
    detail:
      'CoinGecko, con respaldo en CoinPaprika y Kraken. El histórico completo desde 2010 viene de Blockchain.com, con respaldo en CryptoCompare, CoinGecko y Kraken.',
  },
  {
    block: 'Precio en vivo y presión del libro',
    detail:
      'Precio: Binance (spot BTC/USDT) por WebSocket desde el navegador; si no conecta, el precio del servidor cada minuto. Presión del libro: 20 niveles cada 8 s a través del servidor, de Binance con respaldo en OKX y Bybit. Es el libro visible, no anticipa el precio.',
  },
  {
    block: 'Derivados y liquidaciones',
    detail:
      'Futuros perpetuos BTCUSDT: funding, interés abierto y ratios cada 60 s. Binance, con respaldo en OKX y Bybit; los ratios de posiciones los publica el exchange cada hora. El stream de liquidaciones va por WebSocket desde el navegador.',
  },
  {
    block: 'Indicadores técnicos y ciclo on-chain',
    detail:
      'Coin Metrics Community (dato diario): MVRV, capitalización de mercado, emisión y la serie de precio desde 2010. El NUPL, la capitalización realizada y el Puell se derivan de ahí por identidades exactas. Si Coin Metrics no responde, los indicadores se recalculan sobre la serie diaria del proveedor de precio.',
  },
  {
    block: 'Histórico de halvings',
    detail:
      'Se deriva de la serie diaria real (Coin Metrics; si falla, la serie histórica completa del proveedor de precio), revisada cada 3 horas. Las alturas de bloque y las recompensas son hechos de la cadena. El ciclo en curso lleva el suelo provisional (mínimo desde el techo anterior) y la fecha del próximo halving estimada por altura de bloque (mempool.space).',
  },
  {
    block: 'Estado de la red Bitcoin',
    detail:
      'mempool.space, con respaldo en Blockstream: comisiones y mempool cada minuto, hashrate y dificultad cada 30 min. Cuando responde el respaldo, el hashrate y el próximo reajuste se derivan de la propia cadena.',
  },
  {
    block: 'Divergencia ballenas / minoristas',
    detail:
      'Proxy honesto con dos series públicas: valor movido on-chain (dominado por las transferencias grandes) frente a direcciones activas (amplitud del minorista). Blockchain.com, con respaldo en Coin Metrics: series diarias (un dato al día), revisadas cada hora; el punto «Actual» lleva el precio de ahora. El balance literal de ballenas solo lo venden APIs de pago, así que no se muestra.',
  },
  {
    block: 'Liquidez en stablecoins',
    detail: 'DefiLlama, dato diario y no intradía. Solo stablecoins ancladas al dólar.',
  },
  {
    block: 'Miedo y codicia',
    detail: 'alternative.me, un valor al día.',
  },
  {
    block: 'Macroeconomía',
    detail:
      'Reserva Federal de San Luis (FRED), trece series diarias, semanales y mensuales. Cada una se revisa según su frecuencia de publicación y lleva su fecha de observación real.',
  },
  {
    block: 'Altseason',
    detail:
      'Universo y capitalización de CoinGecko (respaldo: CoinPaprika). Rendimientos, medias móviles y volatilidad sobre velas diarias de exchange (Binance, con respaldo en OKX y Bybit), recalculados cada 30 min. El ranking y el marcador van además EN VIVO: cada 5 s llega el precio al contado de todas las monedas, del mismo exchange que las velas, y se rehacen precio, capitalización, variaciones, «vs BTC», fortaleza, la amplitud, ETH/BTC, la dominancia de BTC, la capitalización sin BTC y el score. Una moneda cuyo precio en el exchange no cuadra con el de CoinGecko se descarta: es otro token con el mismo símbolo. Volumen, stablecoins y volatilidad siguen el ritmo de 30 min. La evolución de la amplitud desde 2017 usa una cesta fija de altcoins grandes con años de precio diario (Coin Metrics), rehecha cada 12 h; sus zonas verdes son altseasons: la cesta en el 75% o más, en media de 7 días, durante dos semanas o más. Liquidez de DefiLlama.',
  },
];


// Reglas del detector de fase (services/cycleDetector.ts), en el mismo orden en
// que se evalúan: gana la primera que se cumple.
const BTC_PHASE_RULES: { id: keyof typeof BTC_PHASES; regla: string }[] = [
  { id: 'capitulacion', regla: 'RSI por debajo de 30, Fear & Greed en 15 o menos y caída de más del 35% desde el máximo.' },
  { id: 'correccion', regla: 'Caída de más del 25% desde el máximo con la tendencia bajista.' },
  { id: 'recuperacion', regla: 'Caída de más del 15%, tendencia que ya no es bajista y RSI por debajo de 45.' },
  { id: 'euforia', regla: 'A menos de un 10% del máximo, Fear & Greed de 75 o más y RSI por encima de 70.' },
  { id: 'expansion-avanzada', regla: 'A menos de un 10% del máximo con tendencia alcista.' },
  { id: 'expansion-temprana', regla: 'Tendencia alcista, aún lejos del máximo.' },
  { id: 'acumulacion', regla: 'Ninguna de las anteriores: mercado lateral tras la caída.' },
];

// Por qué está cada indicador del bloque macro y cómo se lee. El dato, su
// fecha y su frecuencia están en Análisis; aquí, el criterio.
const MACRO_GUIDE: { grupo: string; items: { nombre: string; porQue: string; lectura: string; frecuencia: string }[] }[] = [
  {
    grupo: 'Liquidez',
    items: [
      {
        nombre: 'Masa monetaria M2 (interanual)',
        porQue: 'Dinero en circulación en EE. UU. Las fases alcistas de Bitcoin han coincidido con M2 creciendo.',
        lectura: 'Favorable si crece respecto al año anterior; desfavorable si se contrae.',
        frecuencia: 'Mensual (FRED: M2SL).',
      },
      {
        nombre: 'Liquidez neta de la Fed',
        porQue: 'Balance de la Fed menos la cuenta del Tesoro y los repos inversos: el dinero del banco central que de verdad circula. Es la medida de liquidez que más se ha movido con Bitcoin en los últimos ciclos.',
        lectura: 'Favorable si sube en las últimas 8 semanas; desfavorable si baja.',
        frecuencia: 'Semanal (FRED: WALCL − WTREGEN − RRPONTSYD; las unidades se leen de FRED, no se suponen).',
      },
    ],
  },
  {
    grupo: 'Política monetaria y tipos',
    items: [
      {
        nombre: 'Tipo de la Fed',
        porQue: 'El precio del dinero. Las bajadas de tipos abaratan el riesgo.',
        lectura: 'Favorable si ha bajado en el último mes o va a la baja.',
        frecuencia: 'Diaria (FRED: DFF). Antes se usaba la media mensual, que llegaba con semanas de retraso.',
      },
      {
        nombre: 'Inflación (IPC interanual)',
        porQue: 'Decide cuánto margen tiene la Fed para bajar tipos.',
        lectura: 'Favorable por debajo del 3%; desfavorable por encima del 4%.',
        frecuencia: 'Mensual (FRED: CPIAUCSL).',
      },
      {
        nombre: 'Tipo real a 10 años',
        porQue: 'Lo que rinde un activo seguro después de inflación. Bitcoin no da rendimiento, así que compite peor cuando este sube.',
        lectura: 'Favorable si baja en los últimos tres meses; desfavorable si sube.',
        frecuencia: 'Diaria (FRED: DFII10).',
      },
      {
        nombre: 'Curva 10 años – 2 años',
        porQue: 'Señal de ciclo económico: invertida ha precedido a las recesiones.',
        lectura: 'Desfavorable mientras está invertida (negativa).',
        frecuencia: 'Diaria (FRED: T10Y2Y).',
      },
    ],
  },
  {
    grupo: 'Crecimiento y actividad',
    items: [
      {
        nombre: 'Actividad (CFNAI, media 3 meses)',
        porQue: 'Resume 85 indicadores de producción, empleo, consumo y ventas en una cifra. Es la alternativa oficial y gratuita a los PMI compuestos.',
        lectura: 'Favorable por encima de 0 (crecimiento sobre su media); desfavorable por debajo de −0,7.',
        frecuencia: 'Mensual (FRED: CFNAIMA3).',
      },
      {
        nombre: 'Manufactura (Fed de Filadelfia)',
        porQue: 'Encuesta a empresas con la misma lógica que un PMI manufacturero, publicada antes que el ISM y muy correlacionada con él.',
        lectura: 'Favorable por encima de +5; desfavorable por debajo de −5.',
        frecuencia: 'Mensual (FRED: GACDFSA066MSFRBPHI).',
      },
      {
        nombre: 'Desempleo',
        porQue: 'Una subida rápida del paro ha marcado el inicio de las recesiones y fuerza a la Fed a bajar tipos.',
        lectura: 'Desfavorable si sube en los últimos tres meses.',
        frecuencia: 'Mensual (FRED: UNRATE).',
      },
    ],
  },
  {
    grupo: 'Condiciones financieras y riesgo',
    items: [
      {
        nombre: 'Condiciones financieras (NFCI)',
        porQue: 'Índice de la Fed de Chicago que junta crédito, apalancamiento, riesgo y liquidez de mercado.',
        lectura: 'Favorable por debajo de 0 (más laxas que la media).',
        frecuencia: 'Semanal (FRED: NFCI).',
      },
      {
        nombre: 'Spread high yield',
        porQue: 'La prima que paga la deuda de peor calidad: el termómetro del apetito por riesgo en crédito. Las altcoins son especialmente sensibles a él.',
        lectura: 'Favorable por debajo del 4% y sin subir; desfavorable si se ensancha o pasa del 6%.',
        frecuencia: 'Diaria (FRED: BAMLH0A0HYM2).',
      },
      {
        nombre: 'VIX',
        porQue: 'Miedo en la bolsa estadounidense, que suele contagiarse a las cripto.',
        lectura: 'Favorable por debajo de 20; desfavorable por encima de 30.',
        frecuencia: 'Diaria (FRED: VIXCLS).',
      },
      {
        nombre: 'Dólar amplio',
        porQue: 'Un dólar fuerte endurece la liquidez global; uno débil la suaviza.',
        lectura: 'Favorable si baja en los últimos tres meses; desfavorable si sube.',
        frecuencia: 'Diaria, publicada cada lunes (FRED: DTWEXBGS).',
      },
    ],
  },
];

// Las lecturas que antes vivían pegadas a cada gráfico como «💡 Idea clave».
// Reunidas aquí: en la pantalla de datos ocupaban una tarjeta entera por
// bloque, se leían una vez y estorbaban para siempre.
const READINGS = [
  {
    block: 'Caídas y recuperaciones',
    reading:
      'A mayor caída, mayor ha sido históricamente el rally posterior. Es una observación sobre lo ya ocurrido, no una promesa: el mínimo exacto de una caída solo se conoce cuando ya ha pasado, y la caída en curso todavía no tiene rally que contar.',
  },
  {
    block: 'El suelo sigue subiendo',
    reading:
      'Mientras cada mínimo anual quede por encima del anterior, la estructura de largo plazo sigue intacta. Es el argumento habitual de la tesis de «caídas como oportunidad», y depende por completo de que el patrón se mantenga.',
  },
  {
    block: 'Divergencia on-chain',
    reading:
      'Cuando la línea de las ballenas y la del retail se separan mientras el precio cae, suele reflejar monedas pasando de manos débiles a manos fuertes. Los dos indicadores son aproximaciones: valor grande liquidado y direcciones activas, no carteras identificadas.',
  },
  {
    block: 'RSI y Fear & Greed',
    reading:
      'El miedo extremo no marca el suelo exacto, pero históricamente ha estado más cerca de los suelos que de los techos. Un RSI por debajo de 30 dice que la caída ha sido rápida, no que esté terminada: mira el retorno del año siguiente de cada señal pasada, incluidos los que salieron en rojo.',
  },
  {
    block: 'Ciclos de halving',
    reading:
      'Los halvings han marcado el ritmo histórico, pero cada ciclo ha rendido menos que el anterior en porcentaje. Cuatro ciclos son una muestra pequeñísima: sirven para poner contexto, no para calcular un objetivo.',
  },
  {
    block: 'Macro y liquidez',
    reading:
      'Bitcoin no vive aislado: la liquidez global, los tipos y el dólar marcan el apetito por el riesgo. Cuando la M2 crece respecto al año anterior el entorno monetario es más favorable para los activos de riesgo; cuando se contrae, lo contrario.',
  },
  {
    block: 'Altseason',
    reading:
      'El marcador mide amplitud de mercado, no calidad de proyectos. Un valor alto dice que muchas altcoins están rindiendo mejor que Bitcoin ahora mismo, y esas fases han sido siempre las más volátiles.',
  },
];

export function InfoView() {
  const method = describeMethodology();

  return (
    <Card className="!p-0">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <h2 className="text-lg font-bold text-primary">Información</h2>
        <p className="mt-1 text-sm leading-relaxed text-secondary">
          Qué mide cada cosa, cómo se calcula, de dónde salen los datos y qué no es esta
          aplicación. Todo lo que antes ocupaba sitio dentro de las pantallas de datos.
        </p>
      </div>

      <div className="mt-3 divide-y divide-white/10 border-t border-white/10">
        <Section title="Qué es Ciclos BTC" subtitle="Y cómo está organizada">
          <p>
            Un panel de contexto sobre el ciclo de mercado de Bitcoin. Reúne precio, ciclos de
            halving, indicadores técnicos, datos on-chain, derivados, estado de la red y entorno
            macro, siempre a partir de fuentes públicas y gratuitas.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong className="text-primary">Inicio</strong>: precio, fase estimada, tres cifras
              de referencia y el marcador de Altseason.
            </li>
            <li>
              <strong className="text-primary">Ciclos</strong>: el ciclo de Bitcoin con su histórico
              de halvings (incluido el ciclo en curso), las señales de rotación hacia altcoins y la
              comparativa entre ambos relojes y entre ciclos.
            </li>
            <li>
              <strong className="text-primary">Oportunidad</strong>: el termómetro y su desglose
              por bloques. El score aparece aquí y en ningún otro sitio.
            </li>
            <li>
              <strong className="text-primary">Análisis</strong>: todos los indicadores
              desplegados, cada bloque plegable por separado.
            </li>
          </ul>
          <p className="rounded-xl border border-bear/20 bg-bear/5 p-3 text-xs">
            Ninguna cifra de la aplicación predice el precio. Describen lo que está pasando; la
            decisión y el riesgo son tuyos.
          </p>
        </Section>

        <Section title="Cómo se lee la frescura de un dato" subtitle="Las seis etiquetas">
          <p>
            La etiqueta describe la frecuencia REAL de la fuente, no lo reciente que sea la última
            consulta. Un índice que se publica una vez al día es «Diario» aunque se acabe de pedir.
          </p>
          <ul className="space-y-2">
            {FRESHNESS.map((f) => (
              <li key={f.state} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <FreshnessTag freshness={f.state} compact />
                <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
                  {f.meaning}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Fase del ciclo de Bitcoin" subtitle="Cómo se decide, y por qué cambia sola">
          <p>
            La fase no es un texto fijo: se recalcula cada vez que llegan datos nuevos con la caída
            desde el máximo histórico, la tendencia, el RSI de 14 días y el Fear &amp; Greed. Las
            reglas se evalúan en este orden y gana la primera que se cumple; una regla a la que le
            falta un dato no se evalúa, en vez de rellenarlo.
          </p>
          <ul className="space-y-2">
            {BTC_PHASE_RULES.map((r) => {
              const f = BTC_PHASES[r.id];
              return (
                <li key={r.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <p className="text-xs font-semibold" style={{ color: f.color }}>
                    {f.emoji} {f.nombre}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{r.regla}</p>
                </li>
              );
            })}
          </ul>
          <p className="text-xs">
            En Ciclos → Ciclo BTC, la tarjeta «Fase actual» enseña el motivo concreto y las cifras
            de ahora con las que se ha decidido.
          </p>
        </Section>

        <Section title="Score de Oportunidad" subtitle="Cómo se calcula, en claro">
          <p>
            Cada bloque produce una nota de 0 a 100 a partir de sus propios datos y tiene un peso
            fijo. El score es la <strong className="text-primary">media ponderada</strong> de esas
            notas, así que ningún dato suelto puede mover el resultado entero: como mucho mueve su
            bloque. 0 es el riesgo máximo y 100 el contexto más favorable.
          </p>
          <p>
            Los bloques y su peso: ciclo y distancia a máximos (22), tendencia técnica (18),
            sentimiento (15), liquidez (15), derivados (12), riesgo y volatilidad (12) y red (6). La
            liquidez junta las stablecoins con la{' '}
            <strong className="text-primary">liquidez neta de la Fed</strong> (su variación en unas
            ocho semanas) y la M2 interanual: lo que puntúa es si el dinero disponible crece o se
            contrae.
          </p>
          <p>
            Si una fuente no responde, su bloque queda{' '}
            <strong className="text-primary">sin nota, no a cero</strong>. Tratar «no lo sé» como
            «cero» hundiría el score cada vez que fallara una API. En su lugar se reparte su peso
            entre los bloques que sí tienen datos y se rebaja la confianza declarada, que se
            muestra junto al número.
          </p>
          <p>
            El desglose completo —la nota de cada bloque, su peso efectivo y los datos exactos que
            ha usado— está en la pestaña Oportunidad, debajo del termómetro.
          </p>
          <p>
            En la pestaña Oportunidad hay dos tarjetas de evolución. «La fase del ciclo, día a día»
            reconstruye la fase de cada día desde febrero de 2018 con las mismas reglas y los datos de
            ese día (caída desde el mejor cierre hasta entonces, tendencia, RSI y Fear &amp; Greed,
            que empieza en 2018). «Evolución del score» guarda un punto al día desde que se activó: el
            score no se reconstruye hacia atrás porque derivados, liquidez y macro no tienen serie
            histórica.
          </p>
          <p className="rounded-xl border border-bear/20 bg-bear/5 p-3 text-xs">
            La puntuación describe el contexto actual; no predice el precio ni elimina el riesgo de
            nuevas caídas. No es una recomendación de inversión.
          </p>
        </Section>

        <Section title="Altseason Score" subtitle="Métricas, pesos y limitaciones">
          <p>
            Mide si el capital está rotando de Bitcoin hacia las altcoins. Cada métrica se
            normaliza a 0-100 y se pondera; si una fuente no responde, su componente queda{' '}
            <strong className="text-primary">sin nota, no a cero</strong>: su peso se reparte entre
            los disponibles y baja la confianza declarada.
          </p>
          <ul className="space-y-2">
            {method.components.map((c) => (
              <li key={c.label} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-primary">
                    {c.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-btc">{c.weightPct}%</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{c.description}</p>
                <p className="mt-1 font-mono text-[10px] text-muted">{c.range}</p>
              </li>
            ))}
          </ul>
          <div>
            <p className="text-xs font-semibold text-primary">Periodos</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{method.periods}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">Activos excluidos</p>
            <ul className="mt-0.5 list-inside list-disc text-[11px] leading-relaxed text-muted">
              {method.exclusions.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">Penalizaciones</p>
            <ul className="mt-0.5 list-inside list-disc text-[11px] leading-relaxed text-muted">
              {method.penalties.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">Limitaciones</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              La variación histórica de la dominancia no la publica ninguna API gratuita: se deriva
              de las capitalizaciones actuales y sus variaciones, y si la fuente no da un dato
              fiable a 30 días se marca como no disponible en vez de estimarla. El peso efectivo de
              cada componente y su valor de ahora mismo están en Ciclos → Altseason.
            </p>
          </div>
        </Section>

        <Section title="Fases del ciclo de altcoins" subtitle="Qué significa cada una y qué la haría cambiar">
          <p>
            El marcador de Altseason sitúa la rotación de capital en una de estas fases. En la
            pantalla de Altseason solo quedan las señales a favor y en contra; aquí, lo que significa
            cada fase y qué haría falta para avanzar o retroceder.
          </p>
          <ul className="space-y-2">
            {Object.values(ALT_PHASES).map((f) => (
              <li key={f.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-xs font-semibold text-primary">{f.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{f.description}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  <span className="font-semibold text-bull">Para avanzar: </span>
                  {f.next}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                  <span className="font-semibold text-bear">Señal de retroceso: </span>
                  {f.back}
                </p>
              </li>
            ))}
          </ul>
          <div>
            <p className="text-xs font-semibold text-primary">Tramos del marcador</p>
            <ul className="mt-1 space-y-1">
              {CLASSIFICATIONS.map((c, i) => (
                <li key={c.label} className="text-[11px] leading-relaxed text-muted">
                  <span className="font-mono text-secondary">
                    {i === 0 ? 0 : CLASSIFICATIONS[i - 1]!.max + 1}–{c.max}
                  </span>{' '}
                  <strong className="text-secondary">{c.label}</strong>: {c.summary}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title="Bitcoin frente a las altcoins" subtitle="Cómo se lee la pestaña Comparativa">
          <p>
            Son dos relojes distintos que no marcan la misma hora. El de Bitcoin lo fija el halving y
            su recorrido entre el suelo y el máximo del ciclo; el de las altcoins, la rotación de
            capital que mide el Altseason Score.
          </p>
          <p>
            Históricamente la rotación hacia altcoins ha llegado <strong className="text-primary">
            después</strong> del tramo fuerte de Bitcoin: ocurrió en los ciclos de 2017 y 2021. Por
            eso la lectura conjunta se fija en si los dos relojes van sincronizados o desfasados. Que
            el patrón se haya repetido no garantiza que vuelva a hacerlo: describe la situación, no
            es una previsión ni una recomendación.
          </p>
          <p>
            «A la misma altura del ciclo» compara cada ciclo en el mismo punto de su reloj —los días
            que lleva el último halving— en lugar de suelo contra techo, que ya está en el histórico
            de halvings. Cuatro ciclos son una muestra muy pequeña: sirve de contexto, no para
            calcular un objetivo.
          </p>
          <p className="text-xs">
            No existe una serie gratuita de dominancia ni de amplitud de altcoins que llegue a 2017,
            así que la comparación entre ciclos se limita a Bitcoin.
          </p>
        </Section>

        <Section title="Cómo leer cada gráfico" subtitle="Las ideas que antes iban sueltas entre los cuadros">
          <p>
            Aquí está todo lo interpretativo. En las pantallas de datos solo quedan cifras y
            gráficos; lo que sigue es cómo se leen, y ninguna de estas frases es una previsión.
          </p>

          <div className="space-y-3">
            {READINGS.map((r) => (
              <div key={r.block} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-btc">{r.block}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{r.reading}</p>
              </div>
            ))}
          </div>

          <p className="rounded-xl border border-bear/20 bg-bear/5 p-3 text-xs">
            Ninguna de estas lecturas marca suelos ni techos. Describen lo que ha ocurrido antes,
            que es la única cosa que se puede medir.
          </p>
        </Section>

        <Section title="Indicadores macro" subtitle="Por qué están estos y cómo se leen">
          <p>
            Cada indicador está porque ayuda a leer la liquidez, el ciclo económico, la política
            monetaria o el apetito por riesgo, que es lo que mueve a Bitcoin y, detrás, a las
            altcoins. Lo que no cumple eso no entra, aunque haya dato disponible.
          </p>
          <p>
            El punto de color de cada ficha dice si, ahora, ese dato favorece (verde), perjudica
            (rojo) o es neutro para los activos de riesgo. Usa el valor y su tendencia: para Bitcoin
            pesa más hacia dónde va la liquidez que su nivel exacto.
          </p>
          {MACRO_GUIDE.map((g) => (
            <div key={g.grupo}>
              <p className="text-xs font-semibold text-primary">{g.grupo}</p>
              <ul className="mt-1 space-y-1.5">
                {g.items.map((it) => (
                  <li key={it.nombre} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                    <p className="text-xs font-semibold text-secondary">{it.nombre}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{it.porQue}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                      <span className="font-semibold text-secondary">Lectura: </span>
                      {it.lectura}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">{it.frecuencia}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="text-xs font-semibold text-primary">ISM y PMI</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              Los PMI de ISM y de S&amp;P Global son datos de pago: ISM dejó de publicarlos en FRED
              en 2016 y S&amp;P Global no los ofrece gratis. En su lugar se usan las dos referencias
              oficiales y gratuitas que miden lo mismo: la encuesta manufacturera de la Fed de
              Filadelfia (un índice de difusión como el PMI, que lo anticipa) y el CFNAI de la Fed de
              Chicago (actividad general, el equivalente a un PMI compuesto). No hay una alternativa
              oficial y gratuita fiable para el PMI de servicios, así que no se muestra.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">Frescura</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              Cada serie se revisa según su frecuencia real: las diarias cada hora, las semanales
              cada 3 horas y las mensuales cada 6. Así un dato nuevo aparece el mismo día en que se
              publica, sin pedir cada minuto lo que sale una vez al mes. Cada ficha enseña la fecha
              del dato —no la de la consulta— y, si FRED falla, el último dato bueno con su fecha
              real; las series que no se pueden obtener se nombran en vez de desaparecer.
            </p>
          </div>
        </Section>

        <Section title="Glosario" subtitle="Qué significa cada término">
          <dl className="space-y-2.5">
            {GLOSSARY.map((g) => (
              <div key={g.term}>
                <dt className="text-xs font-semibold text-primary">{g.term}</dt>
                <dd className="mt-0.5 text-[11px] leading-relaxed text-muted">{g.definition}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Fuentes de datos" subtitle="Quién sirve cada bloque y con qué respaldo">
          <p>
            Todas son públicas y gratuitas. Cuando un proveedor bloquea o cae, se prueba el
            siguiente de la cadena y la aplicación indica cuál respondió de verdad; lo que no se
            puede obtener queda como «no disponible», nunca inventado.
          </p>
          <dl className="space-y-2.5">
            {SOURCES.map((s) => (
              <div key={s.block}>
                <dt className="text-xs font-semibold text-primary">{s.block}</dt>
                <dd className="mt-0.5 text-[11px] leading-relaxed text-muted">{s.detail}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          title="Aviso legal"
          subtitle="Información educativa, no asesoramiento financiero"
          icon={<ShieldAlert size={16} className="text-btc" aria-hidden="true" />}
        >
          <p>
            Ciclos BTC presenta datos de mercado, estimaciones e indicadores históricos con fines
            exclusivamente informativos y educativos. Nada de lo mostrado constituye una
            recomendación de compra, venta o mantenimiento de Bitcoin ni de ningún otro activo.
          </p>
          <p>
            Los datos históricos no garantizan resultados futuros. Bitcoin es un activo
            extremadamente volátil: su precio puede caer de forma rápida y prolongada, y puedes
            perder parte o la totalidad del capital invertido.
          </p>
          <p>
            Las métricas pueden contener retrasos, errores de proveedor, periodos sin datos o
            cálculos aproximados. Comprueba siempre la información en varias fuentes, realiza tu
            propia investigación y consulta a un profesional autorizado antes de tomar decisiones
            financieras.
          </p>
          <p className="rounded-2xl border border-btc/20 bg-btc/5 p-3.5 font-semibold text-primary">
            No inviertas dinero que no puedas permitirte perder y define previamente tu tolerancia
            al riesgo.
          </p>
        </Section>
      </div>
    </Card>
  );
}

/** Apartado plegable. Todos empiezan cerrados: la lista completa cabe en una pantalla. */
function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  // Cerradas de inicio: son textos largos que no todo el mundo quiere leer.
  const [open, setOpen] = useState(() => collapsiblePreference() ?? false);

  // También obedecen al botón de plegar/desplegar todo de la barra superior.
  useEffect(() => subscribeCollapsibles(setOpen), []);

  return (
    <details className="group" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
            {icon}
            {title}
          </span>
          <span className="mt-0.5 block text-xs leading-tight text-muted">{subtitle}</span>
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-2.5 px-4 pb-4 text-sm leading-relaxed text-secondary sm:px-5 sm:pb-5">
        {children}
      </div>
    </details>
  );
}
