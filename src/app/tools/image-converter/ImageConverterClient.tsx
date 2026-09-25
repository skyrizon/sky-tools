"use client";

import { useEffect, useRef, useState } from "react";
import { zip } from "fflate";
import {
  convertImage,
  supportsQuality,
  baseName,
  OUTPUT_FORMATS,
  type ImageOutputFormat,
} from "@/lib/image-convert";
import { getPdfPageCount, releasePdf, renderPdfPageToImage } from "@/lib/pdf-convert";
import AdSlot from "@/components/AdSlot";
import SupportNote from "@/components/SupportNote";
import { AD_SLOTS } from "@/lib/ads";
import { ToolInfoSection, Faq } from "@/components/ToolInfo";
import { IMAGE_CONVERTER_FAQ } from "./content";

type Item = {
  id: string;
  file: File;
  name: string;
  kind: "image" | "pdf-page";
  pageNumber?: number;
  originalSize?: number;
  status: "pending" | "done" | "error";
  blob?: Blob;
  url?: string;
  error?: string;
};

const LARGE_PDF_PAGES = 100;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageConverterClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<ImageOutputFormat>("image/webp");
  const [quality, setQuality] = useState(0.85);
  const [downloaded, setDownloaded] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const nextId = useRef(0);
  // Only one conversion runs at a time; settingsRef lets a finished job detect
  // that the format or quality changed while it was running.
  const converting = useRef(false);
  const settingsRef = useRef(`${format}|${quality}`);

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPdfError(null);
    setPdfNotice(null);

    for (const file of Array.from(fileList)) {
      if (file.type.startsWith("image/")) {
        setItems((prev) => [
          ...prev,
          { id: String(nextId.current++), file, name: file.name, kind: "image", originalSize: file.size, status: "pending" },
        ]);
        continue;
      }

      if (file.type === "application/pdf") {
        try {
          const pageCount = await getPdfPageCount(file);
          if (pageCount > LARGE_PDF_PAGES) {
            setPdfNotice(
              `"${file.name}" has ${pageCount} pages. Converting them all can take a while and use a lot of memory — remove pages you don't need.`,
            );
          }
          const pdfItems: Item[] = Array.from({ length: pageCount }, (_, i) => ({
            id: String(nextId.current++),
            file,
            name: `${baseName(file.name)} — page ${i + 1}`,
            kind: "pdf-page" as const,
            pageNumber: i + 1,
            status: "pending" as const,
          }));
          setItems((prev) => [...prev, ...pdfItems]);
        } catch {
          setPdfError(`Could not read "${file.name}" as a PDF.`);
        }
      }
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      const rest = prev.filter((i) => i.id !== id);
      if (target && !rest.some((i) => i.file === target.file)) releasePdf(target.file);
      return rest;
    });
  }

  function changeSettings(nextFormat: ImageOutputFormat, nextQuality: number) {
    setFormat(nextFormat);
    setQuality(nextQuality);
    settingsRef.current = `${nextFormat}|${nextQuality}`;
    setItems((prev) => prev.map((i) => (i.status === "pending" ? i : { ...i, status: "pending" })));
  }

  // Convert pending items one at a time. Adding a file or changing settings only
  // (re)converts what is pending instead of redoing the whole list.
  useEffect(() => {
    if (converting.current) return;
    const item = items.find((i) => i.status === "pending");
    if (!item) return;

    converting.current = true;
    const settings = settingsRef.current;
    const job =
      item.kind === "image"
        ? convertImage(item.file, format, quality)
        : renderPdfPageToImage(item.file, item.pageNumber ?? 1, format, quality);

    job.then(
      (blob) => {
        converting.current = false;
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== item.id) return i;
            // Settings changed mid-conversion: leave it pending so it is redone.
            if (settings !== settingsRef.current) return { ...i };
            if (i.url) URL.revokeObjectURL(i.url);
            return { ...i, status: "done", blob, url: URL.createObjectURL(blob), error: undefined };
          }),
        );
      },
      (err) => {
        converting.current = false;
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: err instanceof Error ? err.message : "Conversion failed." }
              : i,
          ),
        );
      },
    );
  }, [items, format, quality]);

  useEffect(() => {
    return () => {
      items.forEach((i) => i.url && URL.revokeObjectURL(i.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outputExt = OUTPUT_FORMATS.find((f) => f.value === format)?.ext ?? "png";

  const [zipping, setZipping] = useState(false);

  function itemFileName(item: Item) {
    const name = item.kind === "pdf-page" ? `${baseName(item.file.name)}-page-${item.pageNumber}` : baseName(item.file.name);
    return `${name}.${outputExt}`;
  }

  function saveUrl(url: string, fileName: string) {
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    link.click();
    setDownloaded(true);
  }

  function downloadItem(item: Item) {
    if (!item.url) return;
    saveUrl(item.url, itemFileName(item));
  }

  async function downloadAll() {
    const done = items.filter((item) => item.status === "done" && item.blob);
    if (done.length === 1) {
      downloadItem(done[0]);
      return;
    }

    setZipping(true);
    try {
      // Images are already compressed, so store them as-is (level 0) for speed.
      const files: Record<string, [Uint8Array, { level: 0 }]> = {};
      for (const item of done) {
        let fileName = itemFileName(item);
        for (let n = 2; files[fileName]; n++) {
          fileName = fileName.replace(/(-\d+)?(\.\w+)$/, `-${n}$2`);
        }
        files[fileName] = [new Uint8Array(await item.blob!.arrayBuffer()), { level: 0 }];
      }
      const data = await new Promise<Uint8Array>((resolve, reject) =>
        zip(files, (err, out) => (err ? reject(err) : resolve(out))),
      );

      const sources = new Set(done.map((item) => item.file.name));
      const zipName = sources.size === 1 ? baseName(done[0].file.name) : "sky-tools-images";
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "application/zip" }));
      saveUrl(url, `${zipName}.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setZipping(false);
    }
  }

  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Image Converter</h1>
      <p className="mt-1 text-muted">
        Convert images between JPG, PNG, and WebP, or turn a PDF into one image per page — entirely
        in your browser. Nothing is uploaded.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <label
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background-raised px-6 py-12 text-center hover:border-accent"
          >
            <span className="font-semibold">Drop images or PDFs here, or click to choose files</span>
            <span className="text-sm text-muted">JPG, PNG, WebP, PDF, or other browser-readable images</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="hidden"
            />
          </label>

          {pdfNotice && (
            <p className="mt-3 rounded-lg bg-accent-soft px-4 py-3 text-sm text-foreground">{pdfNotice}</p>
          )}

          {pdfError && (
            <p className="mt-3 rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">
              {pdfError}
            </p>
          )}

          {items.length > 0 && (
            <div className="mt-6 flex flex-col gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-border-soft bg-background-raised p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.originalSize !== undefined && formatBytes(item.originalSize)}
                      {item.status === "done" && item.blob && (
                        <> {item.originalSize !== undefined && "→"} {formatBytes(item.blob.size)} · .{outputExt}</>
                      )}
                      {item.status === "pending" && " · converting…"}
                      {item.status === "error" && (
                        <span className="text-error"> · {item.error}</span>
                      )}
                    </p>
                  </div>
                  {item.status === "done" && (
                    <button
                      type="button"
                      onClick={() => downloadItem(item)}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-background"
                    >
                      Download
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 text-sm font-semibold text-error hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-background-raised p-6">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Convert to
            <select
              value={format}
              onChange={(e) => changeSettings(e.target.value as ImageOutputFormat, quality)}
              className="rounded-lg border border-border px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft"
            >
              {OUTPUT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          {supportsQuality(format) && (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Quality ({Math.round(quality * 100)}%)
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => changeSettings(format, Number(e.target.value))}
              />
            </label>
          )}

          <button
            type="button"
            onClick={downloadAll}
            disabled={doneCount === 0 || zipping}
            className="mt-2 rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
          >
            {zipping ? "Preparing ZIP…" : doneCount > 1 ? `Download all as ZIP (${doneCount})` : `Download all (${doneCount})`}
          </button>
          {downloaded && <SupportNote />}
        </div>
      </div>

      <ToolInfoSection title="How this converter works">
        <p>
          Every conversion happens locally, using your browser&apos;s built-in image engine — no
          file is ever uploaded to a server. For images, that means a JPG, PNG, or WebP is
          decoded and re-encoded directly in memory; for a PDF, each page is rendered onto a
          canvas at high resolution and then exported as its own image. Because nothing leaves
          your device, this also works with sensitive documents you wouldn&apos;t want to upload
          elsewhere.
        </p>
        <p>
          JPG doesn&apos;t support transparency, so converting a PNG or PDF page with a
          transparent background to JPG fills it with white first — that&apos;s expected, not a
          bug. WebP usually gives the smallest file size at a given quality, which is why
          it&apos;s the default.
        </p>
      </ToolInfoSection>

      <ToolInfoSection title="Frequently asked questions">
        <Faq items={IMAGE_CONVERTER_FAQ} />
      </ToolInfoSection>

      <AdSlot slot={AD_SLOTS.toolPageBottom} className="mt-10" />
    </div>
  );
}
