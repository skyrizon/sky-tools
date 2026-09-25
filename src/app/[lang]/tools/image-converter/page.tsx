import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { toolMetadata } from "@/lib/seo";
import ConversionLinks from "@/components/ConversionLinks";
import ToolPageShell from "@/components/ToolPageShell";
import ImageConverterClient from "./ImageConverterClient";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/tools/image-converter">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return toolMetadata(getDictionary(lang), lang, "image-converter");
}

export default async function ImageConverterPage({
  params,
}: PageProps<"/[lang]/tools/image-converter">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <ToolPageShell
      slug="image-converter"
      lang={lang}
      dict={dict}
      intro={dict.converter.intro}
      howTitle={dict.converter.howTitle}
      howBody={dict.converter.howBody}
      faq={dict.converter.faq}
      extra={<ConversionLinks lang={lang} dict={dict} />}
    >
      <ImageConverterClient t={dict.converter.ui} support={dict.support} />
    </ToolPageShell>
  );
}
