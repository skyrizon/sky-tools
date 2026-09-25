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
