import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { toolMetadata } from "@/lib/seo";
import ToolPageShell from "@/components/ToolPageShell";
import EditPdfClient from "./EditPdfClient";

export async function generateMetadata({ params }: PageProps<"/[lang]/tools/edit-pdf">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return toolMetadata(getDictionary(lang), lang, "edit-pdf");
}

export default async function EditPdfPage({ params }: PageProps<"/[lang]/tools/edit-pdf">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <ToolPageShell
      slug="edit-pdf"
      lang={lang}
      dict={dict}
      intro={dict.editPdf.intro}
      howTitle={dict.editPdf.howTitle}
      howBody={dict.editPdf.howBody}
      faq={dict.editPdf.faq}
      studio
    >
      <EditPdfClient t={dict.editPdf.ui} support={dict.support} />
    </ToolPageShell>
  );
}
