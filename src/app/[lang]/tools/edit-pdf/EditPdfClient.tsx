"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import type { Dictionary } from "@/dictionaries";
import { format as fill } from "@/lib/i18n";
import { saveBlob } from "@/lib/files";
import { baseName } from "@/lib/image-convert";
import { releasePdf, renderPdfPageToImage } from "@/lib/pdf-convert";
import { PdfToolError, buildPdf, pdfPageCount } from "@/lib/pdf-tools";
import FileDropZone from "@/components/FileDropZone";
import { moveItem } from "@/components/OrderedFileList";
import SupportNote from "@/components/SupportNote";

type Page = { id: number; file: File; index: number; rotation: number };

/** Thumbnail cache key: the same source page keeps its image when moved. */
const thumbKey = (page: Page) => `${page.file.name}|${page.file.lastModified}|${page.file.size}|${page.index}`;

export default function EditPdfClient({
  t,
  support,
}: {
  t: Dictionary["editPdf"]["ui"];
  support: Dictionary["support"];
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const nextId = useRef(0);
  const rendering = useRef(false);
  const thumbsRef = useRef(thumbs);

  useEffect(() => {
    thumbsRef.current = thumbs;
  }, [thumbs]);

  // Free thumbnail images and parsed PDFs when leaving the page.
  useEffect(
    () => () => {
      Object.values(thumbsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  // Render missing thumbnails one at a time, in page order.
  useEffect(() => {
    if (rendering.current) return;
    const missing = pages.find((page) => !thumbs[thumbKey(page)]);
    if (!missing) return;
    rendering.current = true;
    const key = thumbKey(missing);
    renderPdfPageToImage(missing.file, missing.index + 1, "image/jpeg", 0.7, 0.35)
      .then((blob) => URL.createObjectURL(blob))
      .catch(() => "")
      .then((url) => {
        rendering.current = false;
        setThumbs((prev) => ({ ...prev, [key]: url }));
      });
  }, [pages, thumbs]);

  function describe(err: unknown): string {
    if (err instanceof PdfToolError) return fill(t[err.code], { file: err.fileName });
    return t.failed;
  }

  async function addFiles(picked: File[]) {
    setError(null);
    for (const file of picked) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) continue;
      try {
        const count = await pdfPageCount(file);
        setFiles((prev) => [...prev, file]);
        setPages((prev) => [
          ...prev,
          ...Array.from({ length: count }, (_, index) => ({ id: nextId.current++, file, index, rotation: 0 })),
        ]);
      } catch (err) {
        setError(describe(err));
      }
    }
  }

  function rotate(id: number, by: number) {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: p.rotation + by } : p)));
  }

  function startOver() {
    files.forEach(releasePdf);
    Object.values(thumbs).forEach((url) => url && URL.revokeObjectURL(url));
    setPages([]);
    setFiles([]);
    setThumbs({});
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const pdf = await buildPdf(pages.map(({ file, index, rotation }) => ({ file, index, rotation })));
      saveBlob(pdf, `${baseName(files[0]?.name ?? "document")}-edited.pdf`);
      setDownloaded(true);
    } catch (err) {
      setError(describe(err));
    } finally {
      setSaving(false);
    }
  }

  const iconButton = "rounded-md p-1 sm:p-1.5 text-muted hover:bg-background hover:text-foreground disabled:opacity-30";
  const secondaryButton =
    "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent-hover";

  if (files.length === 0) {
    return (
      <div className="mt-8">
        <FileDropZone title={t.dropTitle} hint={t.dropHint} accept="application/pdf,.pdf" onFiles={addFiles} />
        {error && <p className="mt-4 rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-soft bg-background-raised p-4">
        <p className="mr-auto text-sm font-semibold">
          {fill(t.pageCount, { count: pages.length })}
          <span className="ml-2 hidden font-normal text-muted sm:inline">{t.dragHint}</span>
        </p>
        <label className={`${secondaryButton} cursor-pointer`}>
          <Plus className="h-4 w-4" />
          {t.addPages}
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              void addFiles(picked);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setPages((prev) => prev.map((p) => ({ ...p, rotation: p.rotation + 90 })))}
          disabled={pages.length === 0}
          className={secondaryButton}
        >
          <RotateCw className="h-4 w-4" />
          {t.rotateAll}
        </button>
        <button type="button" onClick={startOver} className="px-2 text-sm font-semibold text-muted hover:text-foreground">
          {t.startOver}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pages.length === 0 || saving}
          className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-5 py-2 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
        >
          {saving ? t.saving : t.save}
        </button>
      </div>

      {error && <p className="rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>}
      {downloaded && <SupportNote t={support} />}
      {pages.length === 0 && <p className="text-sm text-muted">{t.empty}</p>}

      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {pages.map((page, i) => {
          const thumb = thumbs[thumbKey(page)];
          return (
            <li
              key={page.id}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom === null || dragFrom === i) return;
                setPages((prev) => {
                  const next = [...prev];
                  const [moved] = next.splice(dragFrom, 1);
                  next.splice(i, 0, moved);
                  return next;
                });
                setDragFrom(null);
              }}
              onDragEnd={() => setDragFrom(null)}
              className={`flex cursor-grab flex-col gap-2 rounded-xl border bg-background-raised p-2 transition active:cursor-grabbing ${
                dragFrom === i ? "border-accent opacity-50" : "border-border-soft hover:border-accent"
              }`}
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-background">
                {thumb ? (
                  // Object URL of a locally rendered page; next/image can't optimise those.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={fill(t.pageLabel, { page: i + 1 })}
                    draggable={false}
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                    className="max-h-[85%] max-w-[85%] border border-border-soft bg-white shadow-sm transition-transform"
                  />
                ) : (
                  <span className="h-2/3 w-1/2 animate-pulse rounded bg-border-soft" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="pl-1 text-xs font-semibold text-muted">{i + 1}</span>
                <div className="flex">
                  <button type="button" onClick={() => setPages((prev) => moveItem(prev, i, -1))} disabled={i === 0} aria-label={t.moveEarlier} title={t.moveEarlier} className={iconButton}>
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setPages((prev) => moveItem(prev, i, 1))} disabled={i === pages.length - 1} aria-label={t.moveLater} title={t.moveLater} className={iconButton}>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => rotate(page.id, -90)} aria-label={t.rotateLeft} title={t.rotateLeft} className={iconButton}>
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => rotate(page.id, 90)} aria-label={t.rotateRight} title={t.rotateRight} className={iconButton}>
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPages((prev) => prev.filter((p) => p.id !== page.id))}
                    aria-label={t.remove}
                    title={t.remove}
                    className="rounded-md p-1 text-error hover:bg-error-soft sm:p-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
