import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import { supportsQuality, type ImageOutputFormat } from "@/lib/image-convert";

let workerConfigured = false;

function ensureWorker(): void {
  if (workerConfigured) return;
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerConfigured = true;
}

export async function getPdfPageCount(file: File): Promise<number> {
  ensureWorker();
  const buffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: buffer });
  const doc = await loadingTask.promise;
  const count = doc.numPages;
  await loadingTask.destroy();
  return count;
}

export async function renderPdfPageToImage(
  file: File,
  pageNumber: number,
  format: ImageOutputFormat,
  quality: number,
  scale = 2,
): Promise<Blob> {
  ensureWorker();
  const buffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: buffer });
  const doc = await loadingTask.promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    await loadingTask.destroy();
    throw new Error("Canvas is not supported in this browser.");
  }

  if (format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  await page.render({ canvas, viewport }).promise;
  await loadingTask.destroy();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Could not render page ${pageNumber} of "${file.name}".`));
      },
      format,
      supportsQuality(format) ? quality : undefined,
    );
  });
}
