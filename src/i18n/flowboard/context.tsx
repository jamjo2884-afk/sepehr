"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { type Locale, type TranslationKey, t as translate } from "./translations";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: TranslationKey) => key,
  dir: "ltr",
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslation() {
  const { t, locale } = useLanguage();
  return { t, locale };
}

const STORAGE_KEY = "flowboard_locale";

export function FlowLanguageProvider({ children }: { children: ReactNode }) {
  // Media Deck is Persian-first (root layout is lang=fa dir=rtl), so default
  // to "fa". A persisted user preference still wins after hydration.
  const [locale, setLocaleState] = useState<Locale>("fa");
  const [hydrated, setHydrated] = useState(false);

  // Read persisted locale only after hydration (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "fa" || stored === "en") {
        setLocaleState(stored);
      }
    } catch {}
    setHydrated(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
  }, []);

  const tFn = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );

  // dir must stay "ltr" during initial render (matching server),
  // only update after hydration when locale may have changed to "fa"
  const dir = hydrated ? (locale === "fa" ? "rtl" : "ltr") : "ltr";

  // Update html lang and dir attributes after hydration
  useEffect(() => {
    if (hydrated) {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
    }
  }, [locale, dir, hydrated]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: tFn, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}
