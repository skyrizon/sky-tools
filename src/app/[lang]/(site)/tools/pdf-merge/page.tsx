import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { toolMetadata } from "@/lib/seo";
import ToolPageShell from "@/components/ToolPageShell";
import PdfMergeClient from "./PdfMergeClient";

export async function generateMetadata({ params }: PageProps<"/[lang]/tools/pdf-merge">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return toolMetadata(getDictionary(lang), lang, "pdf-merge");
}

export default async function PdfMergePage({ params }: PageProps<"/[lang]/tools/pdf-merge">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <ToolPageShell
      slug="pdf-merge"
      lang={lang}
      dict={dict}
      intro={dict.pdfMerge.intro}
      howTitle={dict.pdfMerge.howTitle}
      howBody={dict.pdfMerge.howBody}
      faq={dict.pdfMerge.faq}
    >
      <PdfMergeClient t={dict.pdfMerge.ui} support={dict.support} />
    </ToolPageShell>
  );
}
