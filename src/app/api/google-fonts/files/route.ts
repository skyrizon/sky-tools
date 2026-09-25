import { NextResponse } from "next/server";

const DAY = 60 * 60 * 24;

// A non-browser user agent makes Google Fonts answer with one complete, static
// TrueType file per style (no unicode-range splitting, no variable fonts), which
// pdf-lib reads more reliably than WOFF.
const TTF_USER_AGENT = "Wget/1.21";

const VARIANTS = {
  regular: "wght@400",
  bold: "wght@700",
  italic: "ital,wght@1,400",
  boldItalic: "ital,wght@1,700",
} as const;

async function variantUrl(family: string, axis: string): Promise<string | null> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:${axis}`;
  const res = await fetch(url, { headers: { "User-Agent": TTF_USER_AGENT }, next: { revalidate: DAY } });
  if (!res.ok) return null; // this family has no such style
  const css = await res.text();
  return /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(css)?.[1] ?? null;
}

/**
 * Font file URLs (regular, bold, italic, bold italic) for a Google Fonts family.
 * The browser then downloads them from fonts.gstatic.com, which allows it.
 */
export async function GET(request: Request) {
  const family = new URL(request.url).searchParams.get("family") ?? "";
  if (!/^[A-Za-z0-9 ]{1,60}$/.test(family)) {
    return NextResponse.json({ error: "bad family" }, { status: 400 });
  }

  const entries = await Promise.all(
    Object.entries(VARIANTS).map(async ([name, axis]) => [name, await variantUrl(family, axis).catch(() => null)] as const),
  );
  const files = Object.fromEntries(entries.filter(([, url]) => url));
  if (!files.regular) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(files, {
    headers: { "Cache-Control": `public, s-maxage=${DAY}, stale-while-revalidate=${DAY}` },
  });
}
