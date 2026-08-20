import { useState, type ReactNode } from 'react';
import { ChevronDown, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { FreshnessTag, type Freshness } from '@/components/ui/FreshnessTag';
import { describeMethodology } from '@/lib/altseason/config';

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
      'Binance (spot BTC/USDT) por WebSocket desde el navegador: profundidad de 20 niveles, refresco cada 4 s. Es el libro visible, no anticipa el precio.',
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
      'Se deriva de la serie diaria real (Coin Metrics; si falla, la serie histórica completa del proveedor de precio). Las alturas de bloque y las recompensas son hechos de la cadena.',
  },
  {
    block: 'Estado de la red Bitcoin',
    detail:
      'mempool.space, con respaldo en Blockstream: comisiones y mempool cada minuto, hashrate y dificultad cada 30 min. Cuando responde el respaldo, el hashrate y el próximo reajuste se derivan de la propia cadena.',
  },
  {
    block: 'Divergencia ballenas / minoristas',
    detail:
      'Proxy honesto con dos series públicas: valor movido on-chain (dominado por las transferencias grandes) frente a direcciones activas (amplitud del minorista). Blockchain.com, con respaldo en Coin Metrics. El balance literal de ballenas solo lo venden APIs de pago, así que no se muestra.',
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
    detail: 'Reserva Federal de San Luis (FRED). Series mensuales: llevan su fecha de observación real.',
  },
  {
    block: 'Altseason',
    detail:
      'Universo y capitalización de CoinGecko (respaldo: CoinPaprika). Rendimientos, medias móviles y volatilidad sobre velas diarias de exchange (Binance, con respaldo en OKX y Bybit). Liquidez de DefiLlama.',
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
              <strong className="text-primary">Ciclos</strong>: el ciclo de Bitcoin, el apartado
              Altseason y la comparativa entre ciclos.
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

        <Section title="Score de Oportunidad" subtitle="Cómo se calcula, en claro">
          <p>
            Cada bloque produce una nota de 0 a 100 a partir de sus propios datos y tiene un peso
            fijo. El score es la <strong className="text-primary">media ponderada</strong> de esas
            notas, así que ningún dato suelto puede mover el resultado entero: como mucho mueve su
            bloque. 0 es el riesgo máximo y 100 el contexto más favorable.
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
  const [open, setOpen] = useState(false);

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
