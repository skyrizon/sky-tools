import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { toolMetadata } from "@/lib/seo";
import ToolPageShell from "@/components/ToolPageShell";
import QrGeneratorClient from "./QrGeneratorClient";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/tools/qr-generator">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return toolMetadata(getDictionary(lang), lang, "qr-generator");
}

export default async function QrGeneratorPage({ params }: PageProps<"/[lang]/tools/qr-generator">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <ToolPageShell
      slug="qr-generator"
      lang={lang}
      dict={dict}
      intro={dict.qr.intro}
      howTitle={dict.qr.howTitle}
      howBody={dict.qr.howBody}
      faq={dict.qr.faq}
    >
      <QrGeneratorClient t={dict.qr.ui} support={dict.support} />
    </ToolPageShell>
  );
}
