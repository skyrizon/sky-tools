import type { Metadata } from "next";
import type { Tool } from "@/lib/tools";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

export type FaqItem = { q: string; a: string };

/** Metadata for a tool page: keyword title, description, and a canonical URL. */
export function toolMetadata(tool: Tool): Metadata {
  const path = `/tools/${tool.slug}`;
  return {
    title: tool.seoTitle,
    description: tool.description,
    alternates: { canonical: path },
    openGraph: { title: `${tool.seoTitle} | ${SITE_NAME}`, description: tool.description, url: path },
  };
}

/** WebApplication + BreadcrumbList (+ FAQPage) structured data for a tool page. */
export function toolJsonLd(tool: Tool, faq: FaqItem[]): object[] {
  const url = absoluteUrl(`/tools/${tool.slug}`);
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: tool.name,
      description: tool.description,
      url,
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
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: tool.name, item: url },
      ],
    },
    ...(faq.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
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
export function siteJsonLd(): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
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
