import { NextResponse } from "next/server";

/** One Google Fonts family, trimmed for the PDF Studio font picker. */
export type GoogleFontEntry = {
  /** Family name. */
  f: string;
  /** Category, e.g. "Sans Serif", "Serif", "Handwriting". */
  c: string;
  /** Has Thai glyphs. */
  t: boolean;
  /** Has a 700 weight. */
  b: boolean;
  /** Has italics. */
  i: boolean;
};

const DAY = 60 * 60 * 24;

/**
 * The Google Fonts catalogue, most popular first. Fetched from Google's public
 * metadata once a day and trimmed to what the picker needs.
 */
export async function GET() {
  try {
    const res = await fetch("https://fonts.google.com/metadata/fonts", { next: { revalidate: DAY } });
    if (!res.ok) throw new Error(`metadata ${res.status}`);
    const raw = await res.text();
    const data = JSON.parse(raw.replace(/^\)\]\}'/, "")) as {
      familyMetadataList: {
        family: string;
        category: string;
        subsets: string[];
        fonts: Record<string, unknown>;
        popularity: number;
        colorCapabilities?: string[];
      }[];
    };
    const fonts: GoogleFontEntry[] = data.familyMetadataList
      // Colour and icon fonts don't work as text in a PDF.
      .filter((f) => !f.colorCapabilities?.length && !/icons|symbols/i.test(f.family))
      .sort((a, b) => a.popularity - b.popularity)
      .map((f) => ({
        f: f.family,
        c: f.category,
        t: f.subsets.includes("thai"),
        b: "700" in f.fonts,
        i: Object.keys(f.fonts).some((k) => k.endsWith("i")),
      }));
    return NextResponse.json(fonts, {
      headers: { "Cache-Control": `public, s-maxage=${DAY}, stale-while-revalidate=${DAY}` },
    });
  } catch (err) {
    console.error("Google Fonts list failed:", err);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
