import type { Locale } from "@/lib/i18n";
import en, { type Dictionary } from "./en";
import th from "./th";

const dictionaries: Record<Locale, Dictionary> = { en, th };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
