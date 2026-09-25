/**
 * Fonts PDF Studio can write into a PDF. Each covers Thai and Latin, so one
 * font can draw a mixed-language line. `css` is the web font used on screen
 * (defined by next/font on the studio page); `files` are embedded on save.
 * All are SIL Open Font License fonts.
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

export type StudioFontId = keyof typeof STUDIO_FONTS;

export const DEFAULT_FONT: StudioFontId = "sarabun";

/** Slant used for italic, in degrees (the fonts have no italic files, so it is synthesised). */
export const ITALIC_SKEW = 12;

/** Picks the closest studio font for an original PDF font name. */
export function matchFont(originalName: string): StudioFontId {
  if (/times|serif|georgia|garamond|minion|cambria|book|roman/i.test(originalName)) return "serif";
  if (/kanit|prompt|mitr/i.test(originalName)) return "kanit";
  if (/sarabun|thsarabun|angsana|cordia|browallia|tahoma/i.test(originalName)) return "sarabun";
  return "plex";
}
