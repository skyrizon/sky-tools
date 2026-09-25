import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";
import { LOCALES, localePath } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/site";

/** Every page, in every language, each listing its translations as hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "/", priority: 1 },
    ...TOOLS.map((tool) => ({ path: `/tools/${tool.slug}`, priority: 0.9 })),
    { path: "/community", priority: 0.5 },
    { path: "/about", priority: 0.4 },
    { path: "/privacy", priority: 0.2 },
    { path: "/terms", priority: 0.2 },
  ];

  return pages.flatMap(({ path, priority }) => {
    const languages = Object.fromEntries(
      LOCALES.map((locale) => [locale, absoluteUrl(localePath(locale, path))]),
    );
    return LOCALES.map((locale) => ({
      url: absoluteUrl(localePath(locale, path)),
      changeFrequency: "monthly" as const,
      priority,
      alternates: { languages },
    }));
  });
}
