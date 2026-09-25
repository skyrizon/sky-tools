import { getDictionary } from "@/dictionaries";
import { CONVERSIONS, getConversion } from "@/lib/conversions";
import { LOCALES, hasLocale } from "@/lib/i18n";
import { OG_CONTENT_TYPE, OG_SIZE, renderCover } from "@/lib/og-image";

export const alt = "Sky Tools";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Render at build time for every language and format pair.
export function generateStaticParams() {
  return LOCALES.flatMap((lang) => CONVERSIONS.map((c) => ({ lang, pair: c.slug })));
}

export default async function Image({ params }: { params: Promise<{ lang: string; pair: string }> }) {
  const { lang, pair } = await params;
  const dict = getDictionary(hasLocale(lang) ? lang : "en");
  const conversion = getConversion(pair) ?? CONVERSIONS[0];
  const text = dict.conversions.pairs[conversion.slug];
  return renderCover({ eyebrow: dict.meta.ogFreeTool, title: text.h1, subtitle: text.intro });
}
