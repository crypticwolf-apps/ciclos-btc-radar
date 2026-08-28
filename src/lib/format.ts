// Utilidades de formato compartidas por gráficos y tarjetas.

// Todos los formateadores tratan `null` como «no lo sé» y devuelven una raya.
// Es la regla de la aplicación: un hueco se ve como hueco. Que el hueco saliera
// como «0» convertía la falta de un dato en una afirmación —«0 días desde el
// máximo», «0 € el día del halving»— y nadie podía distinguirlas de un dato
// real.
export const SIN_DATO = '—';

export function formatCompact(num: number | null | undefined): string {
  if (num == null || !Number.isFinite(num)) return SIN_DATO;
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

// `null` es un dato que no se tiene, y se enseña como raya. Devolver «0%» en su
// lugar convertía un hueco en una afirmación.
export function formatPercent(num: number | null | undefined, withSign = true): string {
  if (num == null || !Number.isFinite(num)) return '—';
  const sign = withSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(num % 1 === 0 ? 0 : 1)}%`;
}

export function formatGrowth(growth: number): string {
  return growth > 10000 ? (growth / 1000).toFixed(0) + 'K%' : growth + '%';
}

/** "hace 3 min", "hace 2 h", etc. */
export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function formatDateEs(iso: string | null | undefined): string {
  if (!iso) return SIN_DATO;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return SIN_DATO;
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Fecha + hora en zona horaria de España (los datos se guardan en UTC). */
export function formatDateTimeMadrid(iso: string | null | undefined): string {
  if (!iso) return SIN_DATO;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return SIN_DATO;
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(date);
}

/** Número con separadores de miles en español. */
export function formatNumberEs(num: number | null | undefined, maximumFractionDigits = 0): string {
  if (num == null || !Number.isFinite(num)) return SIN_DATO;
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits }).format(num);
}

/**
 * Porcentaje de revalorización con separador de miles SIEMPRE.
 *
 * Intl agrupa a partir de cinco dígitos por defecto (`useGrouping: 'min2'`), así
 * que un +2021% se leía como un año, justo al lado de las fechas de la tabla de
 * ciclos. Con `always` queda +2.021%, que no se confunde.
 */
export function formatGainPct(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  // `useGrouping: 'always'` es ES2023 y el `lib` del proyecto es ES2020, que
  // todavía lo declara como booleano. El navegador sí lo entiende, así que se
  // pasa con una conversión acotada a estas opciones.
  const options = {
    maximumFractionDigits: 0,
    useGrouping: 'always',
  } as unknown as Intl.NumberFormatOptions;
  return `${sign}${new Intl.NumberFormat('es-ES', options).format(pct)}%`;
}

/** Une clases condicionales (mini clsx). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
