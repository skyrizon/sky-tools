export const LOCALES = ["en", "th"] as const;
export type Locale = (typeof LOCALES)[number];

/** English is served without a prefix (/tools/...); other locales get one (/th/tools/...). */
export const DEFAULT_LOCALE: Locale = "en";

export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Public URL path for `path` (which starts with "/") in the given locale. */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Strips a locale prefix from a public pathname: "/th/tools/x" → "/tools/x". */
export function stripLocale(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/** Fills `{name}` placeholders in a dictionary string. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** hreflang alternates + canonical for a page that exists in every locale. */
export function localeAlternates(locale: Locale, path: string) {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])),
      "x-default": localePath(DEFAULT_LOCALE, path),
    },
  };
}
