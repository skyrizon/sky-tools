/**
 * Fonts PDF Studio can draw on screen and embed in a saved PDF.
 *
 * - Built-in fonts ship with the site (Thai + Latin, SIL OFL).
 * - Google Fonts are loaded on demand: the files come from fonts.gstatic.com.
 * - Uploaded fonts are read from a file on the visitor's device (e.g. TH SarabunPSK).
 *
 * Ids: a built-in key ("sarabun"), "gf:<Family>" for Google Fonts, "up:<name>" for uploads.
 */

export const STUDIO_FONTS = {
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
} as const;

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
  source: "google" | "upload";
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
  return loaded.get(id)?.label ?? id.replace(/^(gf|up):/, "");
}

/** CSS font stack for any studio font (older objects without a font use IBM Plex Sans Thai). */
export function fontCss(id: string | undefined): string {
  if (!id || isBuiltin(id)) return `${STUDIO_FONTS[(id as BuiltinFontId) ?? "plex"].css}, sans-serif`;
  const font = loaded.get(id);
  return font ? `'${font.family}', ${STUDIO_FONTS[FALLBACK_FONT].css}, sans-serif` : `${STUDIO_FONTS[FALLBACK_FONT].css}, sans-serif`;
}

/** Whether the font has a real italic face (otherwise italic is a synthetic slant). */
export function hasRealItalic(id: string | undefined, bold: boolean): boolean {
  const font = id ? loaded.get(id) : undefined;
  return !!font?.files[bold ? "boldItalic" : "italic"];
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

/** Downloads a Google Fonts family (all available styles) and registers it. */
export function loadGoogleFont(family: string, thai: boolean): Promise<LoadedFont> {
  const id = `gf:${family}`;
  const existing = loaded.get(id);
  if (existing) return Promise.resolve(existing);
  if (!pending.has(id)) {
    const job = (async () => {
      const res = await fetch(`/api/google-fonts/files?family=${encodeURIComponent(family)}`);
      if (!res.ok) throw new Error(`Font ${family} not available`);
      const urls = (await res.json()) as Partial<Record<Style, string>>;
      const files: Partial<Record<Style, ArrayBuffer>> = {};
      await Promise.all(
        (Object.entries(urls) as [Style, string][]).map(async ([style, url]) => {
          const r = await fetch(url);
          if (r.ok) files[style] = await r.arrayBuffer();
        }),
      );
      if (!files.regular) throw new Error(`Font ${family} failed to download`);
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
  const data = await file.arrayBuffer();
  const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, "").slice(0, 60) || "Font";
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  let thai = false;
  try {
    const parsed = fontkit.create(new Uint8Array(data));
    thai = parsed.hasGlyphForCodePoint(0x0e01);
  } catch {
    throw new Error("Not a font file");
  }
  const id = `up:${name}`;
  const font: LoadedFont = { id, label: name, family: `UP ${name}`, source: "upload", thai, files: { regular: data } };
  await register(font);
  return font;
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
    const url = STUDIO_FONTS[(id as BuiltinFontId) ?? "plex"].files[bold ? "bold" : "regular"];
    if (!fileCache.has(url)) {
      fileCache.set(
        url,
        fetch(url).then((r) => {
          if (!r.ok) throw new Error(`Font ${url} failed to load`);
          return r.arrayBuffer();
        }),
      );
    }
    return { bytes: await fileCache.get(url)!, synthItalic: italic, synthBold: false };
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
  if (/sarabun|thsarabun|angsana|cordia|browallia|tahoma/i.test(originalName)) return "sarabun";
  return "plex";
}
