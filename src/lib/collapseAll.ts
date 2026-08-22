// =============================================================================
// Plegar o desplegar TODOS los cuadros de la aplicación a la vez.
//
// El botón de la barra superior no sabe cuántas tarjetas hay ni dónde están —
// cambian con la pestaña—, así que en lugar de buscarlas en el documento, cada
// tarjeta plegable se apunta aquí al montarse y recibe el aviso.
//
// Es un avisador de dos líneas y no un contexto de React a propósito: el botón
// vive en la cabecera y las tarjetas cuelgan de otra rama del árbol, y meterlas
// a todas bajo un proveedor común obligaría a redibujar la vista entera cada
// vez que se abre o cierra un solo cuadro.
// =============================================================================

type Listener = (open: boolean) => void;

const listeners = new Set<Listener>();

// Última orden dada, para las tarjetas que aún no existían cuando se dio: las
// vistas montan sus cuadros al acercarse a pantalla, y si no se recordara, al
// plegarlo todo y seguir bajando irían apareciendo abiertos uno tras otro.
let preference: boolean | null = null;

/** Abre (`true`) o cierra (`false`) todas las tarjetas apuntadas. */
export function setAllCollapsibles(open: boolean) {
  preference = open;
  for (const listener of listeners) listener(open);
}

/** Cómo debe nacer una tarjeta nueva; `null` si nadie ha dado ninguna orden. */
export function collapsiblePreference() {
  return preference;
}

export function subscribeCollapsibles(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
