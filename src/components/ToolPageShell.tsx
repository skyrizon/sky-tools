import type { Dictionary } from "@/dictionaries";
import type { Locale } from "@/lib/i18n";
import type { ToolSlug } from "@/lib/tools";
import { toolJsonLd, type FaqItem } from "@/lib/seo";
import { AD_SLOTS } from "@/lib/ads";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import RelatedTools from "@/components/RelatedTools";
import { Faq, ToolInfoSection } from "@/components/ToolInfo";

/**
 * Server-rendered frame shared by every tool page: heading, the interactive
 * tool (children), explanation, FAQ, ad, related tools, and structured data.
 * Keeping the text here means it is in the HTML search engines read, in the
 * visitor's language.
 */
export default function ToolPageShell({
  slug,
  lang,
  dict,
  intro,
  howTitle,
  howBody,
  faq,
  heading,
  structuredData,
  extra,
  studio = false,
  children,
}: {
  slug: ToolSlug;
  lang: Locale;
  dict: Dictionary;
  intro: string;
  howTitle: string;
  howBody: string[];
  faq: FaqItem[];
  /** Overrides the tool name as the page heading (format landing pages). */
  heading?: string;
  /** Overrides the default tool structured data. */
  structuredData?: object[];
  /** Rendered after the FAQ, before the ad (e.g. links to related conversions). */
  extra?: React.ReactNode;
  /** Give the tool a wide, app-like workspace instead of the normal content column. */
  studio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={structuredData ?? toolJsonLd(dict, lang, slug, faq)} />
      <div className="mx-auto max-w-5xl px-6 pt-12">
        <h1 className="text-2xl font-bold">{heading ?? dict.tools[slug].name}</h1>
        <p className="mt-1 text-muted">{intro}</p>

        {!studio && children}
      </div>

      {studio && <div className="mx-auto mt-6 max-w-[1400px] px-4 sm:px-6">{children}</div>}

      <div className="mx-auto max-w-5xl px-6 pb-12">
        <ToolInfoSection title={howTitle}>
          {howBody.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </ToolInfoSection>

        <ToolInfoSection title={dict.common.faqTitle}>
          <Faq items={faq} />
        </ToolInfoSection>

        {extra}

        <AdSlot slot={AD_SLOTS.toolPageBottom} className="mt-10" />
      </div>
      <RelatedTools slug={slug} lang={lang} dict={dict} />
    </>
  );
}
