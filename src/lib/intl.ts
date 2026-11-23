// =============================================================================
// Formateadores de números y fechas en español, reutilizados.
//
// Crear un `Intl.NumberFormat` o un `Intl.DateTimeFormat` es caro (carga los
// datos del idioma cada vez), y la app lo hacía en cada cifra, cada fecha y
// cada marca de los ejes de los gráficos: en el perfil de la hoja de escritorio
// era lo que más CPU gastaba después de los propios gráficos. Aquí se crea uno
// por cada combinación de opciones y se guarda. Las combinaciones son las que
// aparecen en el código, unas pocas decenas.
//
// Sin dependencias: lo puede usar también el servidor.
// =============================================================================

const numeros = new Map<string, Intl.NumberFormat>();
const fechas = new Map<string, Intl.DateTimeFormat>();

/** Formateador de números en español con estas opciones (el mismo cada vez). */
export function numeroEs(opciones: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const clave = JSON.stringify(opciones);
  let f = numeros.get(clave);
  if (!f) {
    f = new Intl.NumberFormat('es-ES', opciones);
    numeros.set(clave, f);
  }
  return f;
}

/** Formateador de fechas en español con estas opciones (el mismo cada vez). */
export function fechaEs(opciones: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const clave = JSON.stringify(opciones);
  let f = fechas.get(clave);
  if (!f) {
    f = new Intl.DateTimeFormat('es-ES', opciones);
    fechas.set(clave, f);
  }
  return f;
}
