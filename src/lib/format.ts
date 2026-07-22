// Utilidades de formato compartidas por gráficos y tarjetas.

export function formatCompact(num: number): string {
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

export function formatPercent(num: number, withSign = true): string {
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

export function formatDateEs(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatTimeEs(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(date);
}

/** Fecha + hora en zona horaria de España (los datos se guardan en UTC). */
export function formatDateTimeMadrid(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(iso));
}

/** Número con separadores de miles en español. */
export function formatNumberEs(num: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits }).format(num);
}

/** Une clases condicionales (mini clsx). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
