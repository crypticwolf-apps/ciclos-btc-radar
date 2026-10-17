import { describe, expect, it } from 'vitest';
import { HUECO, estirar, repartir } from './Columnas';

/** Lo que mide cada columna con este reparto. */
function fondos(altos: number[], cols: number[], n: number) {
  const f = new Array<number>(n).fill(0);
  altos.forEach((a, i) => {
    if (a > 0) f[cols[i]!]! += a + HUECO;
  });
  return f;
}

describe('reparto en columnas de escritorio', () => {
  it('la primera fila sale en el orden de la lista, de izquierda a derecha', () => {
    expect(repartir([500, 300, 300], 3)).toEqual([0, 1, 2]);
    expect(repartir([500, 300], 2)).toEqual([0, 1]);
  });

  it('cada cuadro va a la columna que va más corta', () => {
    expect(repartir([500, 300, 300, 300], 2)).toEqual([0, 1, 1, 0]);
  });

  it('recoloca los últimos para que las columnas acaben parejas', () => {
    // A la más corta, uno a uno, el 600 acabaría solo bajo el 100 y quedaría un
    // hueco de 400 px; probando la cola entera, se reparte mejor.
    const altos = [300, 100, 200, 200, 600];
    const voraz = [0, 1, 1, 0, 1];
    const cols = repartir(altos, 2);
    expect(Math.max(...fondos(altos, cols, 2))).toBeLessThan(Math.max(...fondos(altos, voraz, 2)));
    // La primera fila no se toca.
    expect(cols.slice(0, 2)).toEqual([0, 1]);
  });

  it('a igualdad, se queda el orden de lectura', () => {
    expect(repartir([200, 200, 200, 200], 2)).toEqual([0, 1, 0, 1]);
  });

  it('los cuadros vacíos no ocupan sitio ni hueco', () => {
    const cols = repartir([300, 0, 300, 300], 2);
    expect(fondos([300, 0, 300, 300], cols, 2).sort()).toEqual([300 + HUECO, 2 * (300 + HUECO)]);
  });

  it('siempre el mismo reparto para los mismos altos', () => {
    const altos = [400, 200, 250, 380, 120, 640, 90];
    expect(repartir(altos, 3)).toEqual(repartir(altos, 3));
  });
});

describe('cuadrar las columnas de escritorio', () => {
  const si = (k: number) => new Array<boolean>(k).fill(true);

  it('alarga los cuadros de las columnas cortas hasta la más alta', () => {
    const altos = [500, 200, 150, 300];
    const cols = [0, 1, 1, 2];
    const extra = estirar(altos, cols, 3, si(4));
    const final = fondos(altos.map((a, i) => a + extra[i]!), cols, 3);
    expect(new Set(final).size).toBe(1);
    // La más alta no se toca.
    expect(extra[0]).toBe(0);
  });

  it('reparte lo que falta en proporción al alto de cada cuadro', () => {
    const extra = estirar([600, 300, 100], [0, 1, 1], 2, si(3));
    // Faltan 600 - 400 - 16 = 184 px en la segunda columna: 3/4 y 1/4.
    expect(extra).toEqual([0, 138, 46]);
  });

  it('no alarga lo que no se puede (cargando) y sí lo demás de la columna', () => {
    const extra = estirar([600, 300, 100], [0, 1, 1], 2, [true, false, true]);
    expect(extra).toEqual([0, 0, 184]);
  });

  it('una columna con un cuadro plegado se deja como está', () => {
    expect(estirar([600, 56, 300], [0, 1, 1], 2, [true, false, true], [false, true, false])).toEqual([0, 0, 0]);
  });

  it('los cuadros vacíos ni cuentan ni se alargan', () => {
    expect(estirar([400, 0, 200], [0, 1, 1], 2, si(3))).toEqual([0, 0, 200]);
  });
});

