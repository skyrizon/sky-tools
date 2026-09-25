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
  children,
}: {
  slug: ToolSlug;
  lang: Locale;
  dict: Dictionary;
  intro: string;
  howTitle: string;
  howBody: string[];
  faq: FaqItem[];
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={toolJsonLd(dict, lang, slug, faq)} />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold">{dict.tools[slug].name}</h1>
        <p className="mt-1 text-muted">{intro}</p>

        {children}

        <ToolInfoSection title={howTitle}>
          {howBody.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </ToolInfoSection>

        <ToolInfoSection title={dict.common.faqTitle}>
          <Faq items={faq} />
        </ToolInfoSection>

        <AdSlot slot={AD_SLOTS.toolPageBottom} className="mt-10" />
      </div>
      <RelatedTools slug={slug} lang={lang} dict={dict} />
    </>
  );
}
