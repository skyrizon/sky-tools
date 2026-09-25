import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";

/**
 * English lives at unprefixed URLs (/tools/x) and Thai under /th (/th/tools/x).
 * Internally every page sits under app/[lang], so unprefixed requests are
 * rewritten to /en/... and explicit /en/... URLs redirect to the clean URL to
 * avoid duplicate content. Locale is never guessed from the browser, so
 * crawlers always see the same page at the same URL.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generated Open Graph images are linked at their internal /en/... path; serve
  // them directly because some link-preview bots don't follow redirects.
  if (pathname.startsWith(`/${DEFAULT_LOCALE}/`) && pathname.endsWith("/opengraph-image")) {
    return NextResponse.next();
  }

  if (pathname === `/${DEFAULT_LOCALE}` || pathname.startsWith(`/${DEFAULT_LOCALE}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip API routes, Next internals, Vercel analytics, and any file with an extension
  // (robots.txt, sitemap.xml, ads.txt, images, the PDF worker, ...).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
