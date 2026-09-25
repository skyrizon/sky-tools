import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import KofiWidget from "@/components/KofiWidget";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";

/**
 * Website chrome: nav, footer, and the Ko-fi button. Studios render without it.
 * The AdSense script loads from AdSlot, so pages without real content (404,
 * legal pages, community form) never get ads.
 */
export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <SiteNav lang={lang} t={dict.nav} />
      <main className="flex-1">{children}</main>
      <SiteFooter lang={lang} t={dict.footer} />
      <KofiWidget />
    </>
  );
}
