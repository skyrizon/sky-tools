import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { toolMetadata } from "@/lib/seo";
import ToolPageShell from "@/components/ToolPageShell";
import ImageCompressorClient from "./ImageCompressorClient";

export async function generateMetadata({ params }: PageProps<"/[lang]/tools/image-compressor">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return toolMetadata(getDictionary(lang), lang, "image-compressor");
}

export default async function ImageCompressorPage({ params }: PageProps<"/[lang]/tools/image-compressor">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <ToolPageShell
      slug="image-compressor"
      lang={lang}
      dict={dict}
      intro={dict.compressor.intro}
      howTitle={dict.compressor.howTitle}
      howBody={dict.compressor.howBody}
      faq={dict.compressor.faq}
    >
      <ImageCompressorClient t={dict.compressor.ui} support={dict.support} />
    </ToolPageShell>
  );
}
