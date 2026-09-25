import type { Metadata } from "next";
import type { Dictionary } from "@/dictionaries";
import type { ToolSlug } from "@/lib/tools";
import { localeAlternates, localePath, type Locale } from "@/lib/i18n";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

export type FaqItem = { q: string; a: string };

const OG_LOCALES: Record<Locale, string> = { en: "en_US", th: "th_TH" };

/** Title, description, canonical + hreflang, and Open Graph basics for any page. */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle = false,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title: absoluteTitle ? title : `${title} | ${SITE_NAME}`,
      description,
      url: localePath(locale, path),
      locale: OG_LOCALES[locale],
      alternateLocale: Object.entries(OG_LOCALES)
        .filter(([l]) => l !== locale)
        .map(([, og]) => og),
    },
  };
}

export function toolMetadata(dict: Dictionary, locale: Locale, slug: ToolSlug): Metadata {
  const text = dict.tools[slug];
  return pageMetadata({
    locale,
    path: `/tools/${slug}`,
    title: text.seoTitle,
    description: text.metaDescription,
  });
}

/** WebApplication + BreadcrumbList (+ FAQPage) structured data for a tool page. */
export function toolJsonLd(dict: Dictionary, locale: Locale, slug: ToolSlug, faq: FaqItem[]): object[] {
  const text = dict.tools[slug];
  const url = absoluteUrl(localePath(locale, `/tools/${slug}`));
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: text.name,
      description: text.metaDescription,
      url,
      inLanguage: locale,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any (runs in the browser)",
      browserRequirements: "Requires JavaScript",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: dict.common.breadcrumbHome,
          item: absoluteUrl(localePath(locale, "/")),
        },
        { "@type": "ListItem", position: 2, name: text.name, item: url },
      ],
    },
    ...(faq.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            inLanguage: locale,
            mainEntity: faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          },
        ]
      : []),
  ];
}

/** WebSite + Organization structured data for the homepage. */
export function siteJsonLd(dict: Dictionary, locale: Locale): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl(localePath(locale, "/")),
      inLanguage: locale,
      description: dict.meta.siteDescription,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl("/logo-lockup.png"),
      sameAs: ["https://ko-fi.com/skyrizon"],
    },
  ];
}
