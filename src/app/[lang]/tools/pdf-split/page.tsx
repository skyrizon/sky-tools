import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { toolMetadata } from "@/lib/seo";
import ToolPageShell from "@/components/ToolPageShell";
import PdfSplitClient from "./PdfSplitClient";

export async function generateMetadata({ params }: PageProps<"/[lang]/tools/pdf-split">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return toolMetadata(getDictionary(lang), lang, "pdf-split");
}

export default async function PdfSplitPage({ params }: PageProps<"/[lang]/tools/pdf-split">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <ToolPageShell
      slug="pdf-split"
      lang={lang}
      dict={dict}
      intro={dict.pdfSplit.intro}
      howTitle={dict.pdfSplit.howTitle}
      howBody={dict.pdfSplit.howBody}
      faq={dict.pdfSplit.faq}
    >
      <PdfSplitClient t={dict.pdfSplit.ui} support={dict.support} />
    </ToolPageShell>
  );
}
