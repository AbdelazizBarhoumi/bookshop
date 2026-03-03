import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Locale, setLocale, getLocale, t as rawT, formatCurrency as rawFormatCurrency } from './i18n';

interface I18nContextType {
  locale: Locale;
  setLanguage: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatCurrency: (amount: number) => string;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLanguage: () => {},
  t: (key) => key,
  formatCurrency: (amount) => `${amount.toFixed(3)} SDG`,
  isRTL: false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  // Apply locale settings on mount
  useEffect(() => {
    setLocale(locale);
  }, []);

  const setLanguage = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    return rawT(key, params);
  }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = useCallback((amount: number) => {
    return rawFormatCurrency(amount);
  }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRTL = locale === 'ar';

  return (
    <I18nContext.Provider value={{ locale, setLanguage, t, formatCurrency, isRTL }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
