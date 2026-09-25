import { PDFDocument } from "pdf-lib";
import { convertImage } from "@/lib/image-convert";

export type PageSize = "fit" | "a4" | "letter";

/** Page sizes in PDF points (1/72 inch), portrait. */
const PAGE_SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Thrown for PDFs that can't be edited (encrypted or unreadable); `code` maps to UI text. */
export class PdfToolError extends Error {
  constructor(
    public readonly code: "encrypted" | "unreadable",
    public readonly fileName: string,
  ) {
    super(`${code}: ${fileName}`);
  }
}

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

async function loadPdf(file: File): Promise<PDFDocument> {
  const bytes = await file.arrayBuffer();
  try {
    return await PDFDocument.load(bytes);
  } catch (err) {
    const encrypted = err instanceof Error && /encrypt/i.test(err.message);
    throw new PdfToolError(encrypted ? "encrypted" : "unreadable", file.name);
  }
}

export async function pdfPageCount(file: File): Promise<number> {
  return (await loadPdf(file)).getPageCount();
}

/**
 * Builds one PDF with one image per page. JPEGs are re-encoded through the
 * canvas so phone photos come out upright (the browser applies EXIF rotation);
 * PNGs are embedded as-is; anything else is converted to PNG to keep transparency.
 */
export async function imagesToPdf(
  files: File[],
  { pageSize, margin }: { pageSize: PageSize; margin: number },
): Promise<Blob> {
  const pdf = await PDFDocument.create();

  for (const file of files) {
    const image =
      file.type === "image/png"
        ? await pdf.embedPng(await file.arrayBuffer())
        : file.type === "image/jpeg"
          ? await pdf.embedJpg(await (await convertImage(file, "image/jpeg", 0.92)).arrayBuffer())
          : await pdf.embedPng(await (await convertImage(file, "image/png", 1)).arrayBuffer());

    // CSS pixels → points (96 px per inch vs 72 pt per inch).
    const imgW = image.width * 0.75;
    const imgH = image.height * 0.75;

    let pageW: number;
    let pageH: number;
    if (pageSize === "fit") {
      pageW = imgW + margin * 2;
      pageH = imgH + margin * 2;
    } else {
      const [w, h] = PAGE_SIZES[pageSize];
      // Turn the page sideways for landscape images.
      [pageW, pageH] = imgW > imgH ? [h, w] : [w, h];
    }

    const scale = Math.min(1, (pageW - margin * 2) / imgW, (pageH - margin * 2) / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(image, { x: (pageW - drawW) / 2, y: (pageH - drawH) / 2, width: drawW, height: drawH });
  }

  return toBlob(await pdf.save());
}

/** Joins PDFs in the given order into one file. */
export async function mergePdfs(files: File[]): Promise<Blob> {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const source = await loadPdf(file);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return toBlob(await merged.save());
}

/** A new PDF containing only the given pages (0-based indices, in that order). */
export async function extractPages(file: File, pageIndices: number[]): Promise<Blob> {
  const source = await loadPdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(source, pageIndices);
  pages.forEach((page) => out.addPage(page));
  return toBlob(await out.save());
}

/** One single-page PDF per page. */
export async function splitEveryPage(file: File): Promise<Blob[]> {
  const source = await loadPdf(file);
  const results: Blob[] = [];
  for (const index of source.getPageIndices()) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(source, [index]);
    out.addPage(page);
    results.push(toBlob(await out.save()));
  }
  return results;
}

/**
 * Parses page ranges like "1-3, 5, 8-" into 0-based indices, in the order
 * given. Returns null if any part is malformed or out of range.
 */
export function parsePageRanges(input: string, pageCount: number): number[] | null {
  const parts = input.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const indices: number[] = [];
  for (const part of parts) {
    const match = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part);
    if (!match || (!match[1] && !match[3])) return null;
    const start = match[1] ? Number(match[1]) : 1;
    const end = match[2] ? (match[3] ? Number(match[3]) : pageCount) : start;
    if (start < 1 || end > pageCount || start > end) return null;
    for (let page = start; page <= end; page++) indices.push(page - 1);
  }
  return indices;
}
