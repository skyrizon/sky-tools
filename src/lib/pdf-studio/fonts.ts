/**
 * Fonts PDF Studio can draw on screen and embed in a saved PDF.
 *
 * - Built-in fonts ship with the site (Thai + Latin): SIL OFL, and TH Sarabun PSK
 *   under the DIP & SIPA license (free to redistribute unmodified; see
 *   public/fonts/THSarabunPSK-LICENSE.txt).
 * - Google Fonts are loaded on demand: the files come from fonts.gstatic.com.
 * - Uploaded fonts are read from a file on the visitor's device (e.g. TH SarabunPSK).
 *
 * Ids: a built-in key ("sarabun"), "gf:<Family>" for Google Fonts, "up:<name>" for uploads.
 */

import { unzlibSync } from "fflate";

export const STUDIO_FONTS = {
  thsarabun: {
    label: "TH Sarabun PSK",
    css: "var(--font-th-sarabun), 'TH SarabunPSK', 'TH Sarabun PSK'",
    files: {
      regular: "/fonts/THSarabunPSK-Regular.ttf",
      bold: "/fonts/THSarabunPSK-Bold.ttf",
      italic: "/fonts/THSarabunPSK-Italic.ttf",
      boldItalic: "/fonts/THSarabunPSK-BoldItalic.ttf",
    },
  },
  sarabun: {
    label: "Sarabun",
    css: "var(--font-sarabun), 'Sarabun'",
    files: { regular: "/fonts/Sarabun-Regular.ttf", bold: "/fonts/Sarabun-Bold.ttf" },
  },
  plex: {
    label: "IBM Plex Sans Thai",
    css: "var(--font-thai), 'IBM Plex Sans Thai'",
    files: { regular: "/fonts/IBMPlexSansThai-Regular.ttf", bold: "/fonts/IBMPlexSansThai-Bold.ttf" },
  },
  serif: {
    label: "Noto Serif Thai",
    css: "var(--font-serif-thai), 'Noto Serif Thai', serif",
    files: { regular: "/fonts/NotoSerifThai-Regular.ttf", bold: "/fonts/NotoSerifThai-Bold.ttf" },
  },
  kanit: {
    label: "Kanit",
    css: "var(--font-kanit), 'Kanit'",
    files: { regular: "/fonts/Kanit-Regular.ttf", bold: "/fonts/Kanit-Bold.ttf" },
  },
} as const satisfies Record<string, { label: string; css: string; files: { regular: string; bold: string; italic?: string; boldItalic?: string } }>;

export type BuiltinFontId = keyof typeof STUDIO_FONTS;
export type StudioFontId = string;

export const DEFAULT_FONT: BuiltinFontId = "sarabun";
/** Used when a chosen font lacks the glyphs for some text (e.g. Thai in a Latin-only font). */
export const FALLBACK_FONT: BuiltinFontId = "sarabun";

/** Slant used when a font has no italic file, in degrees. */
export const ITALIC_SKEW = 12;

export function isBuiltin(id: string | undefined): id is BuiltinFontId {
  return !!id && id in STUDIO_FONTS;
}

type Style = "regular" | "bold" | "italic" | "boldItalic";

type LoadedFont = {
  id: string;
  label: string;
  /** CSS font-family name the FontFaces were registered under. */
  family: string;
  source: "google" | "upload" | "pdf";
  thai: boolean;
  files: Partial<Record<Style, ArrayBuffer>>;
};

const loaded = new Map<string, LoadedFont>();
const pending = new Map<string, Promise<LoadedFont>>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version++;
  listeners.forEach((listener) => listener());
}

/** For useSyncExternalStore: re-render when fonts finish loading. */
export function subscribeFonts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const fontsVersion = () => version;

export function loadedFonts(): LoadedFont[] {
  return [...loaded.values()];
}

export function fontLabel(id: string | undefined): string {
  if (!id || isBuiltin(id)) return STUDIO_FONTS[(id as BuiltinFontId) ?? "plex"]?.label ?? STUDIO_FONTS.plex.label;
  return loaded.get(id)?.label ?? id.replace(/^(gf|up|pdf):/, "");
}

/**
 * The font used for characters a font lacks. Fonts taken from a PDF fall back to
 * the closest built-in look (e.g. serif); everything else to Sarabun, for Thai.
 */
export function fallbackFont(id: string | undefined): BuiltinFontId {
  if (id?.startsWith("pdf:")) return matchFont(fontLabel(id));
  return FALLBACK_FONT;
}

/** CSS font stack for any studio font (older objects without a font use IBM Plex Sans Thai). */
export function fontCss(id: string | undefined): string {
  if (!id || isBuiltin(id)) return `${STUDIO_FONTS[(id as BuiltinFontId) ?? "plex"].css}, sans-serif`;
  const font = loaded.get(id);
  const fallback = STUDIO_FONTS[fallbackFont(id)].css;
  return font ? `'${font.family}', ${fallback}, sans-serif` : `${fallback}, sans-serif`;
}

/** Whether the font has a real italic face (otherwise italic is a synthetic slant). */
export function hasRealItalic(id: string | undefined, bold: boolean): boolean {
  if (isBuiltin(id)) return bold ? "boldItalic" in STUDIO_FONTS[id].files : "italic" in STUDIO_FONTS[id].files;
  const font = id ? loaded.get(id) : undefined;
  return !!font?.files[bold ? "boldItalic" : "italic"];
}

/**
 * Unwraps a WOFF file into a plain TrueType/OpenType file, which pdf-lib embeds
 * reliably. The glyf table is written last. Other files are returned unchanged.
 */
function toSfnt(data: ArrayBuffer): ArrayBuffer {
  const view = new DataView(data);
  if (data.byteLength < 44 || view.getUint32(0) !== 0x774f4646) return data; // "wOFF"
  const numTables = view.getUint16(12);
  const tables: { tag: number; checksum: number; bytes: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const offset = view.getUint32(at + 4);
    const compLength = view.getUint32(at + 8);
    const origLength = view.getUint32(at + 12);
    const raw = new Uint8Array(data, offset, compLength);
    tables.push({
      tag: view.getUint32(at),
      checksum: view.getUint32(at + 16),
      bytes: compLength < origLength ? unzlibSync(raw) : raw,
    });
  }
  const GLYF = 0x676c7966;
  const order = [...tables].sort((a, b) => Number(a.tag === GLYF) - Number(b.tag === GLYF));
  const headerSize = 12 + 16 * numTables;
  const size = order.reduce((sum, t) => sum + ((t.bytes.length + 3) & ~3), headerSize);
  const out = new Uint8Array(size);
  const outView = new DataView(out.buffer);
  const searchRange = 2 ** Math.floor(Math.log2(numTables)) * 16;
  outView.setUint32(0, view.getUint32(4)); // flavor
  outView.setUint16(4, numTables);
  outView.setUint16(6, searchRange);
  outView.setUint16(8, Math.log2(searchRange / 16));
  outView.setUint16(10, numTables * 16 - searchRange);
  // The directory is sorted by tag; the data follows in `order`.
  let offset = headerSize;
  const placed = new Map<number, number>();
  for (const t of order) {
    placed.set(t.tag, offset);
    out.set(t.bytes, offset);
    offset += (t.bytes.length + 3) & ~3;
  }
  [...tables]
    .sort((a, b) => a.tag - b.tag)
    .forEach((t, i) => {
      const at = 12 + i * 16;
      outView.setUint32(at, t.tag);
      outView.setUint32(at + 4, t.checksum);
      outView.setUint32(at + 8, placed.get(t.tag)!);
      outView.setUint32(at + 12, t.bytes.length);
    });
  return out.buffer;
}

async function register(font: LoadedFont) {
  const faces: [Style, string, string][] = [
    ["regular", "400", "normal"],
    ["bold", "700", "normal"],
    ["italic", "400", "italic"],
    ["boldItalic", "700", "italic"],
  ];
  for (const [style, weight, fontStyle] of faces) {
    const data = font.files[style];
    if (!data) continue;
    const face = new FontFace(font.family, data.slice(0), { weight, style: fontStyle });
    await face.load();
    document.fonts.add(face);
  }
  loaded.set(font.id, font);
  changed();
}

/**
 * Whether pdf-lib can put this font into a saved PDF. Some font files trip it up
 * and would make saving fail, so fonts are tested before they can be chosen.
 */
async function canEmbed(data: ArrayBuffer, subset: boolean, sample = "Aa"): Promise<boolean> {
  const [{ PDFDocument }, { default: fontkit }] = await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit")]);
  try {
    // Padded like export does: fontkit can read just past the last glyph.
    const bytes = new Uint8Array(data.byteLength + 64);
    bytes.set(new Uint8Array(data));
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(bytes, { subset });
    const parsed = fontkit.create(bytes);
    const text = [...sample].filter((ch) => parsed.hasGlyphForCodePoint(ch.codePointAt(0)!)).join("");
    if (text) doc.addPage().drawText(text, { font });
    await doc.save();
    return true;
  } catch {
    return false;
  }
}

/** Downloads a Google Fonts family (all available styles) and registers it. */
export function loadGoogleFont(family: string, thai: boolean): Promise<LoadedFont> {
  const id = `gf:${family}`;
  const existing = loaded.get(id);
  if (existing) return Promise.resolve(existing);
  if (!pending.has(id)) {
    const job = (async () => {
      // `f=ttf`: a new URL, so caches never hand back the older WOFF answer.
      const res = await fetch(`/api/google-fonts/files?family=${encodeURIComponent(family)}&f=ttf`);
      if (!res.ok) throw new Error(`Font ${family} not available`);
      const urls = (await res.json()) as Partial<Record<Style, string>>;
      const files: Partial<Record<Style, ArrayBuffer>> = {};
      await Promise.all(
        (Object.entries(urls) as [Style, string][]).map(async ([style, url]) => {
          const r = await fetch(url);
          if (!r.ok) return;
          const data = toSfnt(await r.arrayBuffer());
          // A style that can't be saved into a PDF is left out (bold/italic are then simulated).
          if (await canEmbed(data, false)) files[style] = data;
        }),
      );
      if (!files.regular) throw new Error(`Font ${family} can't be used`);
      const font: LoadedFont = { id, label: family, family: `GF ${family}`, source: "google", thai, files };
      await register(font);
      return font;
    })();
    job.catch(() => pending.delete(id));
    pending.set(id, job);
  }
  return pending.get(id)!;
}

/** Registers a font file the visitor uploaded (TTF, OTF, or WOFF). */
export async function loadUploadedFont(file: File): Promise<LoadedFont> {
  const data = toSfnt(await file.arrayBuffer());
  const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, "").slice(0, 60) || "Font";
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  let thai = false;
  try {
    const parsed = fontkit.create(new Uint8Array(data));
    thai = parsed.hasGlyphForCodePoint(0x0e01);
  } catch {
    throw new Error("Not a font file");
  }
  if (!(await canEmbed(data, false))) throw new Error("Font can't be saved into a PDF");
  const id = `up:${name}`;
  const font: LoadedFont = { id, label: name, family: `UP ${name}`, source: "upload", thai, files: { regular: data } };
  await register(font);
  return font;
}

/** Whether a font file has a glyph for every visible character of `text`. */
async function covers(data: ArrayBuffer, text: string): Promise<boolean> {
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  try {
    // Padded like export does: fontkit can read just past the last glyph.
    const bytes = new Uint8Array(data.byteLength + 64);
    bytes.set(new Uint8Array(data));
    const font = fontkit.create(bytes);
    if (![...text].every((ch) => /\s/.test(ch) || font.hasGlyphForCodePoint(ch.codePointAt(0)!))) return false;
    // Fonts pulled out of a PDF can be damaged; make sure the needed glyphs read cleanly.
    for (const glyph of font.layout(text).glyphs) void (glyph.advanceWidth + glyph.cbox.width);
    return true;
  } catch {
    return false;
  }
}

/**
 * The closest font for replacing a line of existing PDF text: the PDF's own
 * embedded font when it has every character and can be saved, or else the
 * closest built-in font.
 *
 * `ownStyle` means the font is the PDF's exact face, already bold or italic as
 * needed, so the text should not also be made bold or italic.
 */
export async function fontForPdfText(
  original: { name: string; data: Uint8Array | null; bold: boolean; italic: boolean },
  text: string,
): Promise<{ font: StudioFontId; ownStyle: boolean }> {
  const cleanName = original.name.replace(/^[A-Z]{6}\+/, "") || "PDF font";
  if (original.data) {
    const data = original.data.slice().buffer as ArrayBuffer;
    const id = `pdf:${cleanName}#${data.byteLength}`;
    const existing = loaded.get(id);
    if (existing) {
      if (await covers(existing.files.regular!, text)) return { font: id, ownStyle: true };
    } else if ((await covers(data, text)) && (await canEmbed(data, true, text))) {
      const font: LoadedFont = {
        id,
        label: cleanName,
        family: `PDF ${id}`,
        source: "pdf",
        thai: await covers(data, "ก"),
        files: { regular: data },
      };
      try {
        await register(font);
        return { font: id, ownStyle: true };
      } catch {
        // The browser rejected the file; use a built-in font.
      }
    }
  }
  return { font: matchFont(original.name), ownStyle: false };
}

const fileCache = new Map<string, Promise<ArrayBuffer>>();

/**
 * Bytes to embed for a font and style, and whether italic must be synthesised
 * (no italic file). Missing bold/italic files fall back to the regular face.
 */
export async function fontBytes(
  id: string | undefined,
  bold: boolean,
  italic: boolean,
): Promise<{ bytes: ArrayBuffer; synthItalic: boolean; synthBold: boolean }> {
  if (!id || isBuiltin(id)) {
    const files: { regular: string; bold: string; italic?: string; boldItalic?: string } = STUDIO_FONTS[(id as BuiltinFontId) ?? "plex"].files;
    const italicFile = italic ? (bold ? files.boldItalic : files.italic) : undefined;
    const url = italicFile ?? files[bold ? "bold" : "regular"];
    if (!fileCache.has(url)) {
      fileCache.set(
        url,
        fetch(url).then((r) => {
          if (!r.ok) throw new Error(`Font ${url} failed to load`);
          return r.arrayBuffer();
        }),
      );
    }
    return { bytes: await fileCache.get(url)!, synthItalic: italic && !italicFile, synthBold: false };
  }
  const font = loaded.get(id);
  if (!font) return fontBytes(FALLBACK_FONT, bold, italic);
  const style: Style = bold ? (italic ? "boldItalic" : "bold") : italic ? "italic" : "regular";
  const exact = font.files[style];
  if (exact) return { bytes: exact, synthItalic: false, synthBold: false };
  const upright = bold ? font.files.bold : undefined;
  return {
    bytes: upright ?? font.files.regular!,
    synthItalic: italic,
    synthBold: bold && !upright,
  };
}

/** Picks the closest built-in font for an original PDF font name. */
export function matchFont(originalName: string): BuiltinFontId {
  if (/times|serif|georgia|garamond|minion|cambria|book|roman/i.test(originalName)) return "serif";
  if (/kanit|prompt|mitr/i.test(originalName)) return "kanit";
  if (/th\s*sarabun/i.test(originalName)) return "thsarabun";
  if (/sarabun|angsana|cordia|browallia|tahoma/i.test(originalName)) return "sarabun";
  return "plex";
}
