import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import SiteNav from "@/components/SiteNav";
import Providers from "@/components/Providers";
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
  title: {
    default: "CloudTools",
    template: "%s — CloudTools",
  },
  description: "A growing collection of free, no-nonsense web tools.",
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
        <Providers>
          <SiteNav />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
