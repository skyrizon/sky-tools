import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import KofiWidget from "@/components/KofiWidget";
import { getDictionary } from "@/dictionaries";
import { ADSENSE_CLIENT_ID, ADSENSE_ACCOUNT_META } from "@/lib/ads";
import { LOCALES, hasLocale } from "@/lib/i18n";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist has no Thai glyphs; the browser falls back to this for Thai text.
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai"],
  weight: ["400", "600", "700"],
});

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`,
    },
    description: dict.meta.siteDescription,
    applicationName: SITE_NAME,
    openGraph: { siteName: SITE_NAME, type: "website" },
    twitter: { card: "summary_large_image" },
    other: {
      "google-adsense-account": ADSENSE_ACCOUNT_META,
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} ${plexThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
