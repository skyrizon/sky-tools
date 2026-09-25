import { getDictionary } from "@/dictionaries";
import { LOCALES, hasLocale } from "@/lib/i18n";
import { OG_CONTENT_TYPE, OG_SIZE, renderCover } from "@/lib/og-image";

export const alt = "Sky Tools — free web tools, no sign-up required";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Render at build time for each language instead of on every request.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const dict = getDictionary(hasLocale(lang) ? lang : "en");
  return renderCover({ title: dict.home.h1, subtitle: dict.meta.ogTagline });
}
