import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { getDictionary } from "@/dictionaries";
import { hasLocale, localeAlternates, localePath } from "@/lib/i18n";
import Wordmark from "@/components/Wordmark";
import LanguageSwitch from "@/components/LanguageSwitch";
import EditPdfClient from "@/app/[lang]/(site)/tools/edit-pdf/EditPdfClient";

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
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh">
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
      <EditPdfClient t={dict.editPdf.ui} support={dict.support} fullscreen />
    </div>
  );
}
