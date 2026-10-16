import { describe, expect, it } from 'vitest';
import { ZONAS_MIEDO_CODICIA, zonaMiedoCodicia } from './miedoCodicia';

const nombre = (v: number, etiqueta?: string | null) => ZONAS_MIEDO_CODICIA[zonaMiedoCodicia(v, etiqueta)]!.nombre;

describe('zonas del índice de miedo y codicia', () => {
  it('cubren 0-100 sin huecos', () => {
    ZONAS_MIEDO_CODICIA.forEach((z, i) => i > 0 && expect(z.desde).toBe(ZONAS_MIEDO_CODICIA[i - 1]!.hasta));
    expect(ZONAS_MIEDO_CODICIA[0]!.desde).toBe(0);
    expect(ZONAS_MIEDO_CODICIA[ZONAS_MIEDO_CODICIA.length - 1]!.hasta).toBe(100);
  });

  it('sin etiqueta, cada corte va con la zona de arriba', () => {
    expect(nombre(0)).toBe('Miedo extremo');
    expect(nombre(24)).toBe('Miedo extremo');
    expect(nombre(25)).toBe('Miedo');
    expect(nombre(50)).toBe('Neutral');
    expect(nombre(75)).toBe('Codicia extrema');
    expect(nombre(100)).toBe('Codicia extrema');
  });

  it('la etiqueta del propio índice manda sobre los cortes', () => {
    // Un 46 que el índice llama «Miedo» se enciende como miedo, no como neutral.
    expect(nombre(46, 'Miedo')).toBe('Miedo');
    expect(nombre(46, ' miedo ')).toBe('Miedo');
    // Una etiqueta desconocida no rompe nada: decide el valor.
    expect(nombre(80, 'Greedy')).toBe('Codicia extrema');
    expect(nombre(80, null)).toBe('Codicia extrema');
  });

  it('un valor imposible no se sale de la escala', () => {
    expect(nombre(-5)).toBe('Miedo extremo');
    expect(nombre(140)).toBe('Codicia extrema');
    expect(nombre(Number.NaN)).toBe('Neutral');
  });
});
