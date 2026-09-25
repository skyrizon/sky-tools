import type { Metadata } from "next";
import type { Dictionary } from "@/dictionaries";
import type { ToolSlug } from "@/lib/tools";
import type { ConversionSlug } from "@/lib/conversions";
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

/** WebApplication + BreadcrumbList (+ FAQPage) for any page that hosts a tool. */
function appJsonLd({
  locale,
  name,
  description,
  path,
  crumbs,
  faq,
}: {
  locale: Locale;
  name: string;
  description: string;
  path: string;
  /** Breadcrumb trail after the home page, ending with this page. */
  crumbs: { name: string; path: string }[];
  faq: FaqItem[];
}): object[] {
  const url = absoluteUrl(localePath(locale, path));
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      description,
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
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl(localePath(locale, "/")) },
        ...crumbs.map((crumb, i) => ({
          "@type": "ListItem",
          position: i + 2,
          name: crumb.name,
          item: absoluteUrl(localePath(locale, crumb.path)),
        })),
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

export function toolJsonLd(dict: Dictionary, locale: Locale, slug: ToolSlug, faq: FaqItem[]): object[] {
  const text = dict.tools[slug];
  const path = `/tools/${slug}`;
  return appJsonLd({
    locale,
    name: text.name,
    description: text.metaDescription,
    path,
    crumbs: [{ name: text.name, path }],
    faq,
  });
}

/** Structured data for a format landing page, nested under the Image Converter. */
export function conversionJsonLd(dict: Dictionary, locale: Locale, slug: ConversionSlug): object[] {
  const text = dict.conversions.pairs[slug];
  const path = `/convert/${slug}`;
  return appJsonLd({
    locale,
    name: text.h1,
    description: text.metaDescription,
    path,
    crumbs: [
      { name: dict.tools["image-converter"].name, path: "/tools/image-converter" },
      { name: text.h1, path },
    ],
    faq: text.faq,
  });
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
