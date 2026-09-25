import type { Metadata } from "next";
import Link from "next/link";
import { Charm, Kanit, Noto_Serif_Thai, Sarabun, Sriracha } from "next/font/google";
import localFont from "next/font/local";
import { CircleHelp } from "lucide-react";
import { getDictionary } from "@/dictionaries";
import { hasLocale, localeAlternates, localePath } from "@/lib/i18n";
import Wordmark from "@/components/Wordmark";
import LanguageSwitch from "@/components/LanguageSwitch";
import EditPdfClient from "@/app/[lang]/(site)/tools/edit-pdf/EditPdfClient";

// Handwriting styles (Thai + Latin) for typed signatures.
const signFont1 = Sriracha({ weight: "400", subsets: ["thai", "latin"], variable: "--font-sign-1" });
const signFont2 = Charm({ weight: "700", subsets: ["thai", "latin"], variable: "--font-sign-2" });

// Text fonts offered in the studio; the same fonts are embedded when saving.
const sarabun = Sarabun({ weight: ["400", "700"], subsets: ["thai", "latin"], variable: "--font-sarabun" });
const serifThai = Noto_Serif_Thai({ weight: ["400", "700"], subsets: ["thai", "latin"], variable: "--font-serif-thai" });
const kanit = Kanit({ weight: ["400", "700"], subsets: ["thai", "latin"], variable: "--font-kanit" });
// TH Sarabun PSK (DIP & SIPA license; the same files are embedded into saved PDFs).
const thSarabun = localFont({
  src: [
    { path: "../../../../../../public/fonts/THSarabunPSK-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../../../../../public/fonts/THSarabunPSK-Italic.ttf", weight: "400", style: "italic" },
    { path: "../../../../../../public/fonts/THSarabunPSK-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../../../../../public/fonts/THSarabunPSK-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-th-sarabun",
});

export async function generateMetadata({ params }: PageProps<"/[lang]/studio/edit-pdf">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    title: { absolute: dict.editPdf.studio.metaTitle },
    description: dict.tools["edit-pdf"].metaDescription,
    // The app itself isn't a landing page; search traffic goes to /tools/edit-pdf.
    robots: { index: false, follow: true },
    alternates: localeAlternates(lang, "/studio/edit-pdf"),
  };
}

/** Full-screen PDF Studio, opened in its own tab from the Edit PDF page. */
export default async function PdfStudioPage({ params }: PageProps<"/[lang]/studio/edit-pdf">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <div
      data-studio-root
      className={`${signFont1.variable} ${signFont2.variable} ${sarabun.variable} ${serifThai.variable} ${kanit.variable} ${thSarabun.variable} flex h-dvh flex-col overflow-hidden bg-background`}
    >
      <header className="flex items-center gap-3 border-b border-border bg-background-raised px-4 py-2">
        <Wordmark href={localePath(lang, "/")} height={32} />
        <span className="text-sm font-bold">{dict.editPdf.studio.title}</span>
        <nav className="ml-auto flex items-center gap-4 text-sm font-medium">
          <Link
            href={localePath(lang, "/tools/edit-pdf")}
            className="inline-flex items-center gap-1 text-muted hover:text-foreground"
          >
            <CircleHelp className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">{dict.editPdf.studio.help}</span>
          </Link>
          <LanguageSwitch lang={lang} label={dict.nav.switchLabel} ariaLabel={dict.nav.switchAria} />
        </nav>
      </header>
      <EditPdfClient t={dict.editPdf.ui} support={dict.support} />
    </div>
  );
}
