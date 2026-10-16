import { memo } from 'react';
import {
  BarraLiquida,
  EsferaExtremo,
  LeyendaZonas,
  X_DER,
  X_IZQ,
  ZONA_NEUTRA,
  varsZona,
} from './BarraLiquida';
import { ZONAS_MIEDO_CODICIA, zonaMiedoCodicia } from '@/lib/sentiment/miedoCodicia';
import { CaraCodicia, CaraMiedo } from './IconosMiedoCodicia';

// =============================================================================
// Índice de miedo y codicia en la barra líquida (la del Altseason).
//
// Los extremos del tubo son el miedo (😱 en una esfera roja) y la codicia (🤑
// en una verde), dibujados (ui/IconosMiedoCodicia); la
// escala va de uno a otro, del 0 al 100. Con el índice en miedo extremo brilla
// el del miedo, y en codicia extrema, el de la codicia.
// =============================================================================

const ZONAS = ZONAS_MIEDO_CODICIA;
const CORTES = [0, ...ZONAS.map((z) => z.hasta)];
/** Cada 5, largas en los cortes de zona. */
const MARCAS = Array.from({ length: 21 }, (_, i) => i * 5).map((s) => ({ en: s, larga: CORTES.includes(s) }));
const ROTULOS = CORTES.map((s) => ({ en: s, texto: String(s) }));
const SEPARADORES = CORTES.slice(1, -1);
const MIEDO = ZONAS[0]!;
const CODICIA = ZONAS[ZONAS.length - 1]!;

export const BarraMiedoCodicia = memo(function BarraMiedoCodicia({
  valor,
  etiqueta,
  compact,
}: {
  /** 0-100, o `null` sin dato. */
  valor: number | null;
  /** Etiqueta del propio índice («Miedo», «Codicia»…), si llega. */
  etiqueta?: string | null;
  /** Versión reducida para la pantalla de inicio. */
  compact?: boolean;
}) {
  const valido = valor != null && Number.isFinite(valor);
  const v = valido ? Math.round(Math.max(0, Math.min(100, valor))) : 0;
  const indice = valido ? zonaMiedoCodicia(v, etiqueta) : -1;
  const zona = indice >= 0 ? ZONAS[indice]! : ZONA_NEUTRA;
  const brillo =
    indice === 0 ? { en: 'izq' as const, color: MIEDO.color } : indice === ZONAS.length - 1 ? { en: 'der' as const, color: CODICIA.color } : null;

  const aria = valido
    ? `Índice de miedo y codicia: ${v} de 100, ${zona.nombre}.`
    : 'Índice de miedo y codicia no disponible.';

  return (
    <div className="mx-auto w-full max-w-[560px]" role="img" aria-label={aria}>
      <div className="mb-1 flex items-end justify-between gap-3">
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span
            className={`termo-numero font-mono font-extrabold leading-none tabular-nums ${compact ? 'text-4xl' : 'text-5xl sm:text-6xl'}`}
            style={varsZona(zona)}
          >
            {valido ? v : '—'}
          </span>
          <span className="text-xs font-semibold text-muted">/ 100</span>
        </div>
        <span
          className={`termo-etiqueta whitespace-nowrap rounded-full px-3 py-1 font-bold ${compact ? 'text-xs' : 'text-[13px] sm:text-sm'}`}
          style={varsZona(zona)}
        >
          {valido ? zona.nombre : 'Sin dato'}
        </span>
      </div>

      <BarraLiquida
        valor={valido ? v : null}
        zonas={ZONAS}
        zona={zona}
        marcas={MARCAS}
        rotulos={ROTULOS}
        separadores={SEPARADORES}
        extremoIzq={(id) => (
          <EsferaExtremo id={id} cx={X_IZQ} nombre="miedo" zona={MIEDO}>
            <CaraMiedo id={id} cx={X_IZQ} />
          </EsferaExtremo>
        )}
        extremoDer={(id) => (
          <EsferaExtremo id={id} cx={X_DER} nombre="codicia" zona={CODICIA}>
            <CaraCodicia id={id} cx={X_DER} />
          </EsferaExtremo>
        )}
        brillo={brillo}
      />

      <LeyendaZonas
        zonas={ZONAS}
        activa={indice}
        rango={(z) => `${z.desde}–${z.hasta}`}
        className={`grid-cols-5 ${compact ? 'mt-1' : 'mt-2'}`}
      />
    </div>
  );
});
