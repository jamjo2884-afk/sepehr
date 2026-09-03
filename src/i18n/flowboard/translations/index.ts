import en from "./en";
import fa from "./fa";

export type Locale = "en" | "fa";
export type TranslationKey = keyof typeof en;

export const locales: Locale[] = ["en", "fa"];

export const translations: Record<Locale, Record<string, string>> = { en, fa };

export function t(locale: Locale, key: TranslationKey, params?: Record<string, string | number>): string {
  const value = (translations[locale] as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key;
  if (!params) return value;
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    value
  );
}

export default translations;
