import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { toolMetadata } from "@/lib/seo";
import ToolPageShell from "@/components/ToolPageShell";
import QrScannerClient from "./QrScannerClient";

export async function generateMetadata({ params }: PageProps<"/[lang]/tools/qr-scanner">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return toolMetadata(getDictionary(lang), lang, "qr-scanner");
}

export default async function QrScannerPage({ params }: PageProps<"/[lang]/tools/qr-scanner">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <ToolPageShell
      slug="qr-scanner"
      lang={lang}
      dict={dict}
      intro={dict.qrScanner.intro}
      howTitle={dict.qrScanner.howTitle}
      howBody={dict.qrScanner.howBody}
      faq={dict.qrScanner.faq}
    >
      <QrScannerClient t={dict.qrScanner.ui} support={dict.support} />
    </ToolPageShell>
  );
}
