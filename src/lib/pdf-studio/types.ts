import type { PdfMetadata } from "@/lib/pdf-studio/metadata";
import type { StudioFontId } from "@/lib/pdf-studio/fonts";

/**
 * PDF Studio data model. All positions and sizes are in PDF points, measured
 * in the page's *display* orientation (the way pdf.js shows it, with the
 * page's own /Rotate applied), origin top-left, y pointing down.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type TextAnnotation = {
  type: "text";
  id: string;
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  bold: boolean;
  /** Missing on older objects: treated as "plex", false, false, "left", 1.3. */
  font?: StudioFontId;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  /** Line height as a multiple of the font size. */
  lineHeight?: number;
  /** Set when this text replaces a line of the original PDF (id of that line). */
  replaces?: string;
};

export type ImageAnnotation = {
  type: "image";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** PNG or JPEG data URL. */
  src: string;
  kind: "image" | "signature";
};

export type BoxAnnotation = {
  type: "rect" | "ellipse";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string | null;
  fill: string | null;
  strokeWidth: number;
  opacity: number;
  /** Marks white-out and highlight boxes so the UI can label them. */
  role?: "whiteout" | "highlight";
  /** Set on the cover box of an edited original line (id of that line). */
  replaces?: string;
};

export type LineAnnotation = {
  type: "line";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  arrow: boolean;
};

export type InkAnnotation = {
  type: "ink";
  id: string;
  /** Flat list: x0, y0, x1, y1, ... */
  points: number[];
  stroke: string;
  strokeWidth: number;
  opacity: number;
};

export type Annotation = TextAnnotation | ImageAnnotation | BoxAnnotation | LineAnnotation | InkAnnotation;

export type StudioPage = {
  id: number;
  file: File;
  /** 0-based page index in the source file. */
  index: number;
  /** Extra clockwise rotation added in the studio (multiple of 90). */
  rotation: number;
  /** Display size of the source page in points (before the studio rotation). */
  size: { w: number; h: number };
  annotations: Annotation[];
  /** Visible area, in display points; null keeps the whole page. */
  crop: Rect | null;
};

export type PageNumberPosition =
  | "bottom-center"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "top-right"
  | "top-left";

export type DocOptions = {
  /** Title, author, subject, keywords written into the saved file. */
  metadata: PdfMetadata;
  /** Creation date of the original, kept on the edited copy. */
  created: Date | null;
  watermark: { enabled: boolean; text: string; size: number; color: string; opacity: number };
  pageNumbers: {
    enabled: boolean;
    position: PageNumberPosition;
    /** "{n}" and "{total}" are replaced. */
    template: string;
    start: number;
    size: number;
  };
};

export type Tool =
  | "select"
  | "editText"
  | "text"
  | "signature"
  | "image"
  | "pen"
  | "highlighter"
  | "highlight"
  | "whiteout"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "crop";

/** A form field widget placed on a source page. */
export type FormWidget = {
  /** Unique per source file: field name (+ widget index for radios). */
  key: string;
  fieldName: string;
  type: "text" | "checkbox" | "dropdown" | "radio";
  pageIndex: number;
  rect: Rect;
  options?: string[];
  /** For radio buttons: the value this widget selects. */
  radioValue?: string;
  multiline?: boolean;
};

export type FormValue = string | boolean;

export const DEFAULT_LINE_HEIGHT = 1.3;

/** Baseline of line `i` for text of the given size, relative to the text box top. */
export function textBaseline(size: number, line: number, lineHeight = DEFAULT_LINE_HEIGHT): number {
  return size * 0.95 + line * size * lineHeight;
}

/** Height of `lines` lines of text: the last line gets the standard box height. */
export function textBlockHeight(size: number, lines: number, lineHeight = DEFAULT_LINE_HEIGHT): number {
  return (lines - 1) * size * lineHeight + size * DEFAULT_LINE_HEIGHT;
}

export function textLineHeight(size: number, lineHeight = DEFAULT_LINE_HEIGHT): number {
  return size * lineHeight;
}
