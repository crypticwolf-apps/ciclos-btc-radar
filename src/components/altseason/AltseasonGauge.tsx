import { CLASSIFICATIONS } from '@/lib/altseason/config';
import { ALTSEASON_ZONES, altseasonZoneIndex } from '@/lib/altseason/score';
import {
  BarraLiquida,
  LeyendaZonas,
  MonedaBitcoin,
  MonedaEthereum,
  X_DER,
  X_IZQ,
  ZONA_NEUTRA,
  posicionBarra,
  varsZona,
  type ZonaBarra,
} from '@/components/ui/BarraLiquida';

// =============================================================================
// Marcador del Altseason Score: un tubo de cristal de moneda a moneda.
//
// Las monedas son los extremos del propio tubo: Bitcoin a la izquierda, de
// donde sale el líquido (como el bulbo de un termómetro), y Ethereum cerrándolo
// por la derecha. La escala va de una a otra: el 0 en la de Bitcoin y el 100 en
// la de Ethereum. Así la barra ocupa todo el ancho y se lee bien en el móvil.
//
// El líquido es un degradado continuo por los colores de las zonas, del naranja
// de Bitcoin al morado de la euforia, con volumen, una onda que fluye y
// burbujas; llega hasta el score y el resto del recorrido queda tenue. Los
// cortes de medición van grabados en el vidrio: cada 5, largos y numerados en
// los cortes de zona. Una esfera marca el valor exacto. Con el score en la zona
// de Bitcoin (0-20) su moneda brilla alrededor; en la de euforia (80-100), la de
// Ethereum.
//
// El tubo es la barra líquida común (ui/BarraLiquida), la misma de las barras de
// miedo y codicia y de la fase del ciclo; aquí van las zonas, las monedas y los
// cortes del Altseason.
// =============================================================================

interface AltseasonGaugeProps {
  /** 0-100, o `null` si no se pudo calcular. */
  score: number | null;
  classification: string;
  phaseLabel: string;
  /** Versión reducida para la pantalla de inicio. */
  compact?: boolean;
}

/** Posición horizontal de un valor: 0 en la moneda de Bitcoin, 100 en la de Ethereum. */
export const posicionAltseason = posicionBarra;

/** Qué moneda brilla: la de Bitcoin en su zona (la primera), la de Ethereum en la euforia (la última). */
export function monedaEncendida(score: number | null): 'btc' | 'eth' | null {
  if (score == null || !Number.isFinite(score)) return null;
  const zona = altseasonZoneIndex(score);
  return zona === 0 ? 'btc' : zona === ALTSEASON_ZONES.length - 1 ? 'eth' : null;
}

/** Zonas del Altseason con su rango, tomado de la propia clasificación. */
const ZONAS: readonly ZonaBarra[] = ALTSEASON_ZONES.map((z, i) => ({
  nombre: z.label,
  desde: i === 0 ? 0 : CLASSIFICATIONS[i - 1]!.max,
  hasta: CLASSIFICATIONS[i]!.max,
  color: z.color,
  claro: z.light,
  oscuro: z.dark,
}));

const CORTES = [0, ...CLASSIFICATIONS.map((c) => c.max)];
/** Cada 5, largas en los cortes de zona. */
const MARCAS = Array.from({ length: 21 }, (_, i) => i * 5).map((s) => ({ en: s, larga: CORTES.includes(s) }));
const ROTULOS = CORTES.map((s) => ({ en: s, texto: String(s) }));
const SEPARADORES = CORTES.slice(1, -1);

export function AltseasonGauge({ score, classification, phaseLabel, compact }: AltseasonGaugeProps) {
  const valid = score != null && Number.isFinite(score);
  const clamped = valid ? Math.round(Math.max(0, Math.min(100, score))) : 0;
  const zoneIndex = valid ? altseasonZoneIndex(clamped) : -1;
  const zone = zoneIndex >= 0 ? ZONAS[zoneIndex]! : ZONA_NEUTRA;
  const brilla = monedaEncendida(valid ? clamped : null);

  const aria = valid
    ? `Altseason Score ${clamped} de 100. ${classification}. Fase del ciclo de altcoins: ${phaseLabel}.`
    : 'Altseason Score no disponible por falta de datos.';

  return (
    // Ancho máximo: el dibujo escala entero y, a todo el ancho de una tarjeta de
    // escritorio, la barra y sus números salían gigantes.
    <div className="mx-auto w-full max-w-[560px]" role="img" aria-label={aria}>
      {/* Valor y zona */}
      <div className="mb-1 flex items-end justify-between gap-3">
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span
            className={`termo-numero font-mono font-extrabold leading-none tabular-nums ${compact ? 'text-4xl' : 'text-5xl sm:text-6xl'}`}
            style={varsZona(zone)}
          >
            {valid ? clamped : '—'}
          </span>
          <span className="text-xs font-semibold text-muted">/ 100</span>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1">
          <span
            className={`termo-etiqueta whitespace-nowrap rounded-full px-3 py-1 font-bold ${compact ? 'text-xs' : 'text-[13px] sm:text-sm'}`}
            style={varsZona(zone)}
          >
            {classification}
          </span>
          {!compact && <span className="text-right text-[11px] text-muted">{phaseLabel}</span>}
        </div>
      </div>

      <BarraLiquida
        valor={valid ? clamped : null}
        zonas={ZONAS}
        zona={zone}
        marcas={MARCAS}
        rotulos={ROTULOS}
        separadores={SEPARADORES}
        extremoIzq={(id) => <MonedaBitcoin id={id} cx={X_IZQ} />}
        extremoDer={(id) => <MonedaEthereum id={id} cx={X_DER} />}
        brillo={brilla ? { en: brilla === 'btc' ? 'izq' : 'der', color: brilla === 'btc' ? '#f7931a' : '#8ea2ff' } : null}
      />

      <LeyendaZonas
        zonas={ZONAS}
        activa={zoneIndex}
        rango={(z) => `${z.desde}–${z.hasta}`}
        className={`grid-cols-5 ${compact ? 'mt-1' : 'mt-2'}`}
      />
    </div>
  );
}
