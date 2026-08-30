"use client";

import { useEffect, useRef, useState } from "react";
import {
  convertImage,
  supportsQuality,
  baseName,
  OUTPUT_FORMATS,
  type ImageOutputFormat,
} from "@/lib/image-convert";
import { getPdfPageCount, renderPdfPageToImage } from "@/lib/pdf-convert";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageConverterClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<ImageOutputFormat>("image/webp");
  const [quality, setQuality] = useState(0.85);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const nextId = useRef(0);

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPdfError(null);

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
      return prev.filter((i) => i.id !== id);
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      for (const item of items) {
        if (cancelled) return;
        try {
          const blob =
            item.kind === "image"
              ? await convertImage(item.file, format, quality)
              : await renderPdfPageToImage(item.file, item.pageNumber ?? 1, format, quality);
          if (cancelled) return;
          setItems((prev) =>
            prev.map((i) => {
              if (i.id !== item.id) return i;
              if (i.url) URL.revokeObjectURL(i.url);
              return { ...i, status: "done", blob, url: URL.createObjectURL(blob), error: undefined };
            }),
          );
        } catch (err) {
          if (cancelled) return;
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: "error", error: err instanceof Error ? err.message : "Conversion failed." }
                : i,
            ),
          );
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // Re-run whenever the file list, format, or quality changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(","), format, quality]);

  useEffect(() => {
    return () => {
      items.forEach((i) => i.url && URL.revokeObjectURL(i.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outputExt = OUTPUT_FORMATS.find((f) => f.value === format)?.ext ?? "png";

  function downloadItem(item: Item) {
    if (!item.url) return;
    const link = document.createElement("a");
    const name = item.kind === "pdf-page" ? `${baseName(item.file.name)}-page-${item.pageNumber}` : baseName(item.file.name);
    link.download = `${name}.${outputExt}`;
    link.href = item.url;
    link.click();
  }

  function downloadAll() {
    items.forEach((item) => item.status === "done" && downloadItem(item));
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
              onChange={(e) => setFormat(e.target.value as ImageOutputFormat)}
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
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </label>
          )}

          <button
            type="button"
            onClick={downloadAll}
            disabled={doneCount === 0}
            className="mt-2 rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
          >
            Download all ({doneCount})
          </button>
        </div>
      </div>

      <AdSlot slot={AD_SLOTS.toolPageBottom} className="mt-10" />
    </div>
  );
}
