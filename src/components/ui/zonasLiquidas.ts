import type { CSSProperties } from 'react';

// Lo común de las barras líquidas (ui/BarraLiquida) que también usa la rueda de
// fases. Va aparte para que la rueda, que sale en Inicio, no arrastre la barra
// entera al paquete inicial.

export interface ZonaBarra {
  nombre: string;
  /** Rango en la escala 0-100 de la barra. */
  desde: number;
  hasta: number;
  color: string;
  claro: string;
  oscuro: string;
}

/** Colores de una zona como variables CSS: index.css elige la variante que se lee en cada tema. */
export const varsZona = (z: Pick<ZonaBarra, 'color' | 'claro' | 'oscuro'>) =>
  ({ '--tc-color': z.color, '--tc-claro': z.claro, '--tc-oscuro': z.oscuro }) as CSSProperties;
