import type { Currency } from '@/types/market';

export const DEFAULT_USD_TO_EUR = 0.92;

export interface MoneyFormatOptions {
  compact?: boolean;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
}

export function isValidExchangeRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0.5 && value < 1.5;
}

export function convertFromUsd(value: number, currency: Currency, usdToEur: number): number {
  return currency === 'eur' ? value * usdToEur : value;
}

export function formatMoney(
  value: number,
  currency: Currency,
  options: MoneyFormatOptions = {},
): string {
  const { compact = false, maximumFractionDigits, minimumFractionDigits, signDisplay } = options;
  // `useGrouping: 'always'` es ES2023 y el `lib` del proyecto es ES2020, que lo
  // declara como booleano; el navegador sí lo entiende. Sin esto Intl no agrupa
  // las cifras de cuatro dígitos, y en una misma columna aparecían «2791 €»
  // junto a «13.810 €», que parece un error de formato.
  const grouping = { useGrouping: compact ? 'auto' : 'always' } as unknown as Intl.NumberFormatOptions;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'narrowSymbol',
    notation: compact ? 'compact' : 'standard',
    compactDisplay: 'short',
    maximumFractionDigits: maximumFractionDigits ?? (compact ? 1 : Math.abs(value) < 1 ? 2 : 0),
    minimumFractionDigits,
    signDisplay,
    ...grouping,
  }).format(value);
}

export function formatMoneyFromUsd(
  valueUsd: number,
  currency: Currency,
  usdToEur: number,
  options?: MoneyFormatOptions,
): string {
  return formatMoney(convertFromUsd(valueUsd, currency, usdToEur), currency, options);
}

