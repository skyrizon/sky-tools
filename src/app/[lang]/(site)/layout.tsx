import Script from "next/script";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import KofiWidget from "@/components/KofiWidget";
import { getDictionary } from "@/dictionaries";
import { ADSENSE_CLIENT_ID } from "@/lib/ads";
import { hasLocale } from "@/lib/i18n";

/** Website chrome: nav, footer, ads, and the Ko-fi button. Studios render without it. */
export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <SiteNav lang={lang} t={dict.nav} />
      <main className="flex-1">{children}</main>
      <SiteFooter lang={lang} t={dict.footer} />
      <KofiWidget />
    </>
  );
}
