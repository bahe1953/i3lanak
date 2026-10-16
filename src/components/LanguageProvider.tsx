"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { dict, type Locale } from "@/lib/i18n";

type Ctx = { locale: Locale; setLocale: (l: Locale) => void };
const LanguageContext = createContext<Ctx>({ locale: "fr", setLocale: () => {} });

// La langue initiale vient du cookie « lang » (lu côté serveur dans layout.tsx),
// ce qui la conserve d'une page à l'autre sans clignotement.
export function LanguageProvider({ children, initial }: { children: ReactNode; initial: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  function setLocale(l: Locale) {
    setLocaleState(l);
    document.cookie = `lang=${l};path=/;max-age=31536000;samesite=lax`;
  }

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return <LanguageContext.Provider value={{ locale, setLocale }}>{children}</LanguageContext.Provider>;
}

export function useLocale() {
  return useContext(LanguageContext);
}

export function useT() {
  const { locale } = useLocale();
  const d = dict[locale];
  return (path: string) => {
    let cur: unknown = d;
    for (const p of path.split(".")) {
      if (cur && typeof cur === "object" && p in cur) cur = (cur as Record<string, unknown>)[p];
      else return path;
    }
    return typeof cur === "string" ? cur : path;
  };
}
