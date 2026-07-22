import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Currency } from '@/types/market';
import {
  DEFAULT_USD_TO_EUR,
  formatMoney,
  formatMoneyFromUsd,
  isValidExchangeRate,
  type MoneyFormatOptions,
} from '@/lib/currency';

const CURRENCY_KEY = 'ciclos-btc-currency';
const RATE_KEY = 'ciclos-btc-usd-eur-rate';

type RateSource = 'market' | 'cached' | 'fallback';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  usdToEur: number;
  rateSource: RateSource;
  syncExchangeRate: (rate: number | null | undefined) => void;
  formatFromUsd: (value: number, options?: MoneyFormatOptions) => string;
  formatCompactFromUsd: (value: number, options?: MoneyFormatOptions) => string;
  formatDirect: (value: number, options?: MoneyFormatOptions) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readCurrency(): Currency {
  if (typeof window === 'undefined') return 'eur';
  return window.localStorage.getItem(CURRENCY_KEY) === 'usd' ? 'usd' : 'eur';
}

function readRate(): { value: number; source: RateSource } {
  if (typeof window !== 'undefined') {
    const cached = Number(window.localStorage.getItem(RATE_KEY));
    if (isValidExchangeRate(cached)) return { value: cached, source: 'cached' };
  }
  return { value: DEFAULT_USD_TO_EUR, source: 'fallback' };
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(readCurrency);
  const initialRate = useMemo(readRate, []);
  const [usdToEur, setUsdToEur] = useState(initialRate.value);
  const [rateSource, setRateSource] = useState<RateSource>(initialRate.source);

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next);
    window.localStorage.setItem(CURRENCY_KEY, next);
  }, []);

  const syncExchangeRate = useCallback((rate: number | null | undefined) => {
    if (!isValidExchangeRate(rate)) return;
    setUsdToEur(rate);
    setRateSource('market');
    window.localStorage.setItem(RATE_KEY, String(rate));
  }, []);

  const formatFromUsd = useCallback(
    (value: number, options?: MoneyFormatOptions) =>
      formatMoneyFromUsd(value, currency, usdToEur, options),
    [currency, usdToEur],
  );
  const formatCompactFromUsd = useCallback(
    (value: number, options?: MoneyFormatOptions) =>
      formatMoneyFromUsd(value, currency, usdToEur, { ...options, compact: true }),
    [currency, usdToEur],
  );
  const formatDirect = useCallback(
    (value: number, options?: MoneyFormatOptions) => formatMoney(value, currency, options),
    [currency],
  );

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      usdToEur,
      rateSource,
      syncExchangeRate,
      formatFromUsd,
      formatCompactFromUsd,
      formatDirect,
    }),
    [
      currency,
      setCurrency,
      usdToEur,
      rateSource,
      syncExchangeRate,
      formatFromUsd,
      formatCompactFromUsd,
      formatDirect,
    ],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency debe usarse dentro de CurrencyProvider');
  return context;
}

