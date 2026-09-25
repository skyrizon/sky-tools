import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import { supportsQuality, type ImageOutputFormat } from "@/lib/image-convert";

/** Longest edge of a rendered page, in pixels — keeps huge pages from exhausting memory. */
const MAX_RENDER_EDGE = 4000;

let workerConfigured = false;

function ensureWorker(): void {
  if (workerConfigured) return;
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerConfigured = true;
}

// Each PDF is parsed once and reused for every page, instead of re-reading the
// whole file per page.
const openDocs = new Map<File, Promise<PDFDocumentLoadingTask>>();

async function openPdf(file: File): Promise<PDFDocumentProxy> {
  let task = openDocs.get(file);
  if (!task) {
    ensureWorker();
    task = file.arrayBuffer().then((buffer) => getDocument({ data: buffer }));
    openDocs.set(file, task);
  }
  try {
    return await (await task).promise;
  } catch (err) {
    // A file that fails to parse shouldn't stay cached.
    releasePdf(file);
    throw err;
  }
}

/** Frees a parsed PDF once none of its pages are needed any more. */
export function releasePdf(file: File): void {
  const task = openDocs.get(file);
  if (!task) return;
  openDocs.delete(file);
  task.then((t) => t.destroy()).catch(() => {});
}

/** A line of existing text on a page, in display points (top-left origin). */
export type TextRun = {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Baseline y and font size, used to place replacement text in the same spot. */
  baseline: number;
  size: number;
  /** True when the original font's name says it is bold. */
  bold: boolean;
  /** The original font's name (e.g. "Helvetica-Bold"), for picking a similar font. */
  fontName: string;
};

type PdfTextItem = { str: string; transform: number[]; width: number; fontName: string; hasEOL?: boolean };

/**
 * Groups the page's horizontal text into lines (runs) that can be clicked and
 * replaced. Rotated or vertical text is skipped.
 */
export async function getTextRuns(file: File, pageIndex: number): Promise<TextRun[]> {
  const doc = await openPdf(file);
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const [va, vb, vc, vd, ve, vf] = viewport.transform;

  // Loading the operator list makes pdf.js resolve the page's fonts, whose real
  // names (e.g. "Helvetica-Bold") tell us which text is bold.
  await page.getOperatorList();
  const realNames = new Map<string, string>();
  const realName = (fontName: string) => {
    if (!realNames.has(fontName)) {
      let name = "";
      try {
        if (page.commonObjs.has(fontName)) name = (page.commonObjs.get(fontName) as { name?: string })?.name ?? "";
      } catch {
        // Font not available; treat as unknown.
      }
      realNames.set(fontName, name);
    }
    return realNames.get(fontName)!;
  };

  const pieces: { text: string; x: number; baseline: number; w: number; size: number; bold: boolean; fontName: string }[] = [];
  for (const raw of content.items as PdfTextItem[]) {
    if (!("str" in raw) || !raw.str) continue;
    const [a, b, c, d, e, f] = raw.transform;
    // Item transform combined with the viewport transform → display space.
    const ta = va * a + vc * b;
    const tb = vb * a + vd * b;
    const tc = va * c + vc * d;
    const td = vb * c + vd * d;
    const tx = va * e + vc * f + ve;
    const ty = vb * e + vd * f + vf;
    if (Math.abs(tb) > 0.01 * Math.abs(ta) || ta <= 0) continue; // not left-to-right horizontal
    const size = Math.hypot(tc, td);
    if (size < 1) continue;
    pieces.push({ text: raw.str, x: tx, baseline: ty, w: raw.width * (ta / Math.hypot(a, b) || 1), size, bold: /bold|black|heavy|semibold|demi/i.test(realName(raw.fontName)), fontName: realName(raw.fontName) });
  }

  // Merge pieces that sit on the same baseline and follow each other closely.
  pieces.sort((p, q) => p.baseline - q.baseline || p.x - q.x);
  const runs: TextRun[] = [];
  let line: (typeof pieces)[number] | null = null;
  const flush = () => {
    if (!line || !line.text.trim()) return;
    const text = line.text.replace(/\s+/g, " ").trim();
    const top = line.baseline - line.size * 0.9;
    runs.push({
      id: `${pageIndex}:${runs.length}:${Math.round(line.x)}:${Math.round(line.baseline)}`,
      text,
      x: line.x,
      y: top,
      w: line.w,
      h: line.size * 1.15,
      baseline: line.baseline,
      size: line.size,
      bold: line.bold,
      fontName: line.fontName,
    });
  };
  for (const piece of pieces) {
    const sameLine =
      line &&
      Math.abs(piece.baseline - line.baseline) < line.size * 0.35 &&
      piece.x - (line.x + line.w) < line.size * 1.2 &&
      piece.x >= line.x;
    if (line && sameLine) {
      const gap = piece.x - (line.x + line.w);
      const needsSpace = gap > line.size * 0.15 && !line.text.endsWith(" ") && !piece.text.startsWith(" ");
      line.text += (needsSpace ? " " : "") + piece.text;
      line.w = Math.max(line.w, piece.x + piece.w - line.x);
      line.size = Math.max(line.size, piece.size);
    } else {
      flush();
      line = { ...piece };
    }
  }
  flush();
  page.cleanup();
  return runs;
}

/** Each page's size in points as displayed (with the page's own rotation applied). */
export async function getPdfPageSizes(file: File): Promise<{ w: number; h: number }[]> {
  const doc = await openPdf(file);
  const sizes: { w: number; h: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const viewport = (await doc.getPage(i)).getViewport({ scale: 1 });
    sizes.push({ w: viewport.width, h: viewport.height });
  }
  return sizes;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const doc = await openPdf(file);
  return doc.numPages;
}

export async function renderPdfPageToImage(
  file: File,
  pageNumber: number,
  format: ImageOutputFormat,
  quality: number,
  scale = 2,
): Promise<Blob> {
  const doc = await openPdf(file);
  const page = await doc.getPage(pageNumber);

  const base = page.getViewport({ scale: 1 });
  const fittedScale = Math.min(scale, MAX_RENDER_EDGE / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale: fittedScale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser.");
  }

  if (format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  try {
    // "print" intent renders without requestAnimationFrame, so conversion keeps
    // going when the tab is in the background (rAF is paused for hidden tabs).
    await page.render({ canvas, viewport, intent: "print" }).promise;
  } finally {
    page.cleanup();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Release the canvas backing store right away rather than waiting for GC.
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error(`Could not render page ${pageNumber} of "${file.name}".`));
      },
      format,
      supportsQuality(format) ? quality : undefined,
    );
  });
}
