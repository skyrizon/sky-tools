import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { toolMetadata } from "@/lib/seo";
import ToolPageShell from "@/components/ToolPageShell";
import ImagesToPdfClient from "./ImagesToPdfClient";

export async function generateMetadata({ params }: PageProps<"/[lang]/tools/images-to-pdf">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return toolMetadata(getDictionary(lang), lang, "images-to-pdf");
}

export default async function ImagesToPdfPage({ params }: PageProps<"/[lang]/tools/images-to-pdf">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <ToolPageShell
      slug="images-to-pdf"
      lang={lang}
      dict={dict}
      intro={dict.imagesToPdf.intro}
      howTitle={dict.imagesToPdf.howTitle}
      howBody={dict.imagesToPdf.howBody}
      faq={dict.imagesToPdf.faq}
    >
      <ImagesToPdfClient t={dict.imagesToPdf.ui} support={dict.support} />
    </ToolPageShell>
  );
}
