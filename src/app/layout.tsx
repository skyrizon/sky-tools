import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import KofiWidget from "@/components/KofiWidget";
import { ADSENSE_CLIENT_ID, ADSENSE_ACCOUNT_META } from "@/lib/ads";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tools.skyrizon.online"),
  title: {
    default: "Sky Tools",
    template: "%s — Sky Tools",
  },
  description: "A growing collection of free, no-nonsense web tools.",
  openGraph: { siteName: "Sky Tools", type: "website" },
  twitter: { card: "summary_large_image" },
  other: {
    "google-adsense-account": ADSENSE_ACCOUNT_META,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <SiteNav />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <KofiWidget />
      </body>
    </html>
  );
}
