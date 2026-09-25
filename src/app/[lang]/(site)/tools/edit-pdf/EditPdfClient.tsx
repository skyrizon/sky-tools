"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
} from "lucide-react";
import type { Dictionary } from "@/dictionaries";
import { format as fill } from "@/lib/i18n";
import { saveBlob } from "@/lib/files";
import { baseName } from "@/lib/image-convert";
import { releasePdf, renderPdfPageToImage } from "@/lib/pdf-convert";
import { PdfToolError, buildPdf, pdfPageCount } from "@/lib/pdf-tools";
import FileDropZone from "@/components/FileDropZone";
import SupportNote from "@/components/SupportNote";

type Page = { id: number; file: File; index: number; rotation: number };
type T = Dictionary["editPdf"]["ui"];

/** Image cache key: the same source page keeps its images when moved or duplicated. */
const sourceKey = (page: Page) => `${page.file.name}|${page.file.lastModified}|${page.file.size}|${page.index}`;
const HISTORY_LIMIT = 50;

export default function EditPdfClient({
  t,
  support,
  fullscreen = false,
}: {
  t: T;
  support: Dictionary["support"];
  /** Fill the whole window (the standalone studio page) instead of a framed box. */
  fullscreen?: boolean;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [past, setPast] = useState<Page[][]>([]);
  const [future, setFuture] = useState<Page[][]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const nextId = useRef(0);
  const anchor = useRef(0);
  const renderingThumb = useRef(false);
  const renderingPreview = useRef<string | null>(null);
  const urlsRef = useRef<string[]>([]);
  const railRef = useRef<HTMLOListElement>(null);

  const currentIndex = Math.max(0, pages.findIndex((p) => p.id === currentId));
  const current = pages[currentIndex] as Page | undefined;
  const currentPageId = current?.id;
  // Actions apply to the selection, or to the page on the canvas when nothing is selected.
  const targets = useMemo(
    () => (selected.size > 0 ? selected : new Set(currentPageId !== undefined ? [currentPageId] : [])),
    [selected, currentPageId],
  );

  // ----- history -----
  const commit = useCallback(
    (next: Page[]) => {
      setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), pages]);
      setFuture([]);
      setPages(next);
    },
    [pages],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    setFuture((f) => [pages, ...f]);
    setPages(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }, [past, pages]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    setPast((p) => [...p, pages]);
    setPages(future[0]);
    setFuture((f) => f.slice(1));
  }, [future, pages]);

  // ----- page images -----
  function remember(url: string) {
    urlsRef.current.push(url);
    return url;
  }

  useEffect(() => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  // Large preview for the page on the canvas, rendered first so the canvas never waits on thumbnails.
  useEffect(() => {
    if (!current) return;
    const key = sourceKey(current);
    if (previews[key] || renderingPreview.current === key) return;
    renderingPreview.current = key;
    renderPdfPageToImage(current.file, current.index + 1, "image/jpeg", 0.85, 1.6)
      .then((blob) => remember(URL.createObjectURL(blob)))
      .catch(() => "")
      .then((url) => {
        renderingPreview.current = null;
        setPreviews((prev) => ({ ...prev, [key]: url }));
      });
  }, [current, previews]);

  // Thumbnails, one at a time in page order.
  useEffect(() => {
    if (renderingThumb.current) return;
    const missing = pages.find((page) => thumbs[sourceKey(page)] === undefined);
    if (!missing) return;
    renderingThumb.current = true;
    const key = sourceKey(missing);
    renderPdfPageToImage(missing.file, missing.index + 1, "image/jpeg", 0.7, 0.3)
      .then((blob) => remember(URL.createObjectURL(blob)))
      .catch(() => "")
      .then((url) => {
        renderingThumb.current = false;
        setThumbs((prev) => ({ ...prev, [key]: url }));
      });
  }, [pages, thumbs]);

  // Keep the current page's thumbnail in view in the rail.
  useEffect(() => {
    railRef.current?.querySelector(`[data-page-id="${currentId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentId]);

  // ----- actions -----
  function describe(err: unknown): string {
    if (err instanceof PdfToolError) return fill(t[err.code], { file: err.fileName });
    return t.failed;
  }

  async function addFiles(picked: File[]) {
    setError(null);
    let added: Page[] = [];
    const newFiles: File[] = [];
    for (const file of picked) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) continue;
      try {
        const count = await pdfPageCount(file);
        newFiles.push(file);
        added = [
          ...added,
          ...Array.from({ length: count }, (_, index) => ({ id: nextId.current++, file, index, rotation: 0 })),
        ];
      } catch (err) {
        setError(describe(err));
      }
    }
    if (added.length === 0) return;
    setFiles((prev) => [...prev, ...newFiles]);
    commit([...pages, ...added]);
    if (currentId === null) {
      setCurrentId(added[0].id);
      setSelected(new Set([added[0].id]));
    }
  }

  function select(event: React.MouseEvent, page: Page, index: number) {
    if (event.shiftKey) {
      const [from, to] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
      setSelected(new Set(pages.slice(from, to + 1).map((p) => p.id)));
    } else if (event.ctrlKey || event.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(page.id)) next.delete(page.id);
        else next.add(page.id);
        return next;
      });
      anchor.current = index;
    } else {
      setSelected(new Set([page.id]));
      anchor.current = index;
    }
    setCurrentId(page.id);
  }

  const goTo = useCallback(
    (index: number) => {
      const page = pages[Math.min(Math.max(index, 0), pages.length - 1)];
      if (!page) return;
      setCurrentId(page.id);
      setSelected(new Set([page.id]));
      anchor.current = pages.indexOf(page);
    },
    [pages],
  );

  const rotate = useCallback(
    (by: number, all = false) => {
      commit(pages.map((p) => (all || targets.has(p.id) ? { ...p, rotation: p.rotation + by } : p)));
    },
    [commit, pages, targets],
  );

  const removeSelected = useCallback(() => {
    if (targets.size === 0) return;
    const remaining = pages.filter((p) => !targets.has(p.id));
    const firstRemoved = pages.findIndex((p) => targets.has(p.id));
    const nextCurrent = remaining[Math.min(firstRemoved, remaining.length - 1)];
    commit(remaining);
    setCurrentId(nextCurrent?.id ?? null);
    setSelected(new Set(nextCurrent ? [nextCurrent.id] : []));
  }, [commit, pages, targets]);

  function duplicateSelected() {
    const copies: Page[] = [];
    const next = pages.flatMap((p) => {
      if (!targets.has(p.id)) return [p];
      const copy = { ...p, id: nextId.current++ };
      copies.push(copy);
      return [p, copy];
    });
    commit(next);
    setSelected(new Set(copies.map((c) => c.id)));
    if (copies[0]) setCurrentId(copies[0].id);
  }

  /** Moves every selected page one step, keeping their relative order. */
  function moveSelected(direction: -1 | 1) {
    const next = [...pages];
    const order = direction === -1 ? next.map((_, i) => i) : next.map((_, i) => next.length - 1 - i);
    for (const i of order) {
      const j = i + direction;
      if (!targets.has(next[i].id) || j < 0 || j >= next.length || targets.has(next[j].id)) continue;
      [next[i], next[j]] = [next[j], next[i]];
    }
    commit(next);
  }

  function dropOn(index: number) {
    if (dragFrom === null || dragFrom === index) return;
    const next = [...pages];
    const [moved] = next.splice(dragFrom, 1);
    next.splice(index, 0, moved);
    commit(next);
    setDragFrom(null);
  }

  function startOver() {
    files.forEach(releasePdf);
    setPages([]);
    setPast([]);
    setFuture([]);
    setFiles([]);
    setSelected(new Set());
    setCurrentId(null);
    setError(null);
  }

  const save = useCallback(async () => {
    if (pages.length === 0 || saving) return;
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
    // describe only reads dictionary text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, saving, files]);

  // ----- keyboard shortcuts -----
  useEffect(() => {
    if (pages.length === 0) return;
    function onKey(event: KeyboardEvent) {
      // Don't hijack keys while typing in a form field.
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z" && !event.shiftKey) undo();
      else if (mod && (key === "y" || (key === "z" && event.shiftKey))) redo();
      else if (mod && key === "s") void save();
      else if (mod && key === "a") setSelected(new Set(pages.map((p) => p.id)));
      else if (!mod && (event.key === "ArrowLeft" || event.key === "ArrowUp")) goTo(currentIndex - 1);
      else if (!mod && (event.key === "ArrowRight" || event.key === "ArrowDown")) goTo(currentIndex + 1);
      else if (!mod && key === "r") rotate(event.shiftKey ? -90 : 90);
      else if (!mod && (event.key === "Delete" || event.key === "Backspace")) removeSelected();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages, currentIndex, undo, redo, save, goTo, rotate, removeSelected]);

  // ----- render -----
  if (files.length === 0) {
    const dropZone = (
      <>
        <FileDropZone title={t.dropTitle} hint={t.dropHint} accept="application/pdf,.pdf" onFiles={addFiles} />
        {error && <p className="mt-4 rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>}
      </>
    );
    return fullscreen ? (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xl">{dropZone}</div>
      </div>
    ) : (
      <div className="rounded-2xl border border-border-soft bg-background-raised p-4 sm:p-8">{dropZone}</div>
    );
  }

  const toolButton =
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-muted hover:bg-background hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  const panelButton =
    "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent-hover disabled:opacity-40 disabled:hover:border-border disabled:hover:text-inherit";
  const quarterTurned = current ? (((current.rotation % 360) + 360) % 180) === 90 : false;
  const canvasImage = current ? previews[sourceKey(current)] || thumbs[sourceKey(current)] : undefined;

  return (
    <div
      className={
        fullscreen
          ? "flex flex-1 flex-col bg-background-raised lg:min-h-0"
          : "overflow-hidden rounded-2xl border border-border bg-background-raised shadow-lg shadow-black/5"
      }
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-2 sm:px-3">
        <span className="mr-2 flex min-w-0 items-center gap-2 px-1 text-sm font-semibold">
          <FileText className="h-4 w-4 shrink-0 text-accent-hover" />
          <span className="max-w-[12rem] truncate">{files[0].name}</span>
          <span className="shrink-0 font-normal text-muted">· {fill(t.pageCount, { count: pages.length })}</span>
        </span>
        <label className={`${toolButton} cursor-pointer`}>
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">{t.addPages}</span>
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
        <button type="button" onClick={undo} disabled={past.length === 0} title={`${t.undo} (Ctrl+Z)`} aria-label={t.undo} className={toolButton}>
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={redo} disabled={future.length === 0} title={`${t.redo} (Ctrl+Y)`} aria-label={t.redo} className={toolButton}>
          <Redo2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => rotate(90, true)} disabled={pages.length === 0} className={toolButton}>
          <RotateCw className="h-4 w-4" />
          <span className="hidden md:inline">{t.rotateAll}</span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={startOver} className={toolButton}>
            {t.startOver}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={pages.length === 0 || saving}
            title="Ctrl+S"
            className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>

      {error && <p className="border-b border-border bg-error-soft px-4 py-2 text-sm font-semibold text-error">{error}</p>}

      <div
        className={`grid grid-cols-1 lg:grid-cols-[184px_minmax(0,1fr)_264px] ${
          fullscreen ? "lg:min-h-0 lg:flex-1" : "lg:h-[min(78vh,820px)]"
        }`}
      >
        {/* Page rail */}
        <aside className="order-2 border-t border-border lg:order-none lg:overflow-y-auto lg:border-r lg:border-t-0">
          <p className="hidden px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted lg:block">{t.pages}</p>
          <ol ref={railRef} className="flex gap-3 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
            {pages.map((page, i) => {
              const thumb = thumbs[sourceKey(page)];
              const isSelected = selected.has(page.id);
              const isCurrent = page.id === current?.id;
              return (
                <li
                  key={page.id}
                  data-page-id={page.id}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropOn(i);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                  className="shrink-0"
                >
                  <button
                    type="button"
                    onClick={(e) => select(e, page, i)}
                    aria-label={fill(t.pageLabel, { page: i + 1 })}
                    aria-pressed={isSelected}
                    className={`flex w-24 flex-col items-center gap-1.5 rounded-xl border-2 p-1.5 transition lg:w-full ${
                      dragFrom === i ? "opacity-40" : ""
                    } ${
                      isSelected
                        ? "border-accent bg-accent-soft"
                        : "border-transparent hover:border-border hover:bg-background"
                    }`}
                  >
                    <span className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md bg-background">
                      {thumb ? (
                        // Object URL of a locally rendered page; next/image can't optimise those.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          draggable={false}
                          style={{ transform: `rotate(${page.rotation}deg)` }}
                          className="max-h-[88%] max-w-[88%] bg-white shadow-sm transition-transform"
                        />
                      ) : (
                        <span className="h-3/4 w-2/3 animate-pulse rounded bg-border-soft" />
                      )}
                    </span>
                    <span className={`text-xs font-semibold ${isCurrent ? "text-accent-hover" : "text-muted"}`}>{i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Canvas */}
        <section className="relative order-1 flex h-[60vh] min-h-[360px] items-center justify-center bg-background [container-type:size] lg:order-none lg:h-auto">
          {pages.length === 0 ? (
            <p className="px-6 text-center text-sm text-muted">{t.empty}</p>
          ) : (
            <>
              {canvasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={canvasImage}
                  alt={fill(t.pageLabel, { page: currentIndex + 1 })}
                  style={{
                    transform: `rotate(${current?.rotation ?? 0}deg)`,
                    // When turned sideways, the page's height runs along the canvas width.
                    maxHeight: quarterTurned ? "88cqw" : "88cqh",
                    maxWidth: quarterTurned ? "88cqh" : "88cqw",
                  }}
                  className="bg-white shadow-xl shadow-black/10 transition-transform duration-200"
                />
              ) : (
                <span className="h-2/3 w-1/3 animate-pulse rounded bg-border-soft" />
              )}
              <button
                type="button"
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                aria-label={t.previous}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background-raised p-2 shadow-sm hover:text-accent-hover disabled:opacity-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => goTo(currentIndex + 1)}
                disabled={currentIndex >= pages.length - 1}
                aria-label={t.next}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background-raised p-2 shadow-sm hover:text-accent-hover disabled:opacity-0"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/80 px-3 py-1 text-xs font-semibold text-white">
                {fill(t.pageOf, { page: currentIndex + 1, count: pages.length })}
              </span>
            </>
          )}
        </section>

        {/* Inspector */}
        <aside className="order-3 flex flex-col gap-5 border-t border-border p-4 lg:order-none lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div>
            <p className="font-bold">
              {targets.size > 1
                ? fill(t.selectedCount, { count: targets.size })
                : fill(t.pageOf, { page: currentIndex + 1, count: pages.length })}
            </p>
            {current && targets.size <= 1 && (
              <p className="mt-0.5 truncate text-xs text-muted">
                {fill(t.source, { file: current.file.name, page: current.index + 1 })}
              </p>
            )}
            <p className="mt-2 hidden text-xs text-muted lg:block">{t.selectHint}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => rotate(-90)} disabled={targets.size === 0} className={panelButton}>
              <RotateCcw className="h-4 w-4" />
              {t.rotateLeft}
            </button>
            <button type="button" onClick={() => rotate(90)} disabled={targets.size === 0} className={panelButton}>
              <RotateCw className="h-4 w-4" />
              {t.rotateRight}
            </button>
            <button type="button" onClick={() => moveSelected(-1)} disabled={targets.size === 0 || targets.has(pages[0]?.id)} className={panelButton}>
              <ArrowUp className="h-4 w-4" />
              {t.moveEarlier}
            </button>
            <button type="button" onClick={() => moveSelected(1)} disabled={targets.size === 0 || targets.has(pages[pages.length - 1]?.id)} className={panelButton}>
              <ArrowDown className="h-4 w-4" />
              {t.moveLater}
            </button>
            <button type="button" onClick={duplicateSelected} disabled={targets.size === 0} className={panelButton}>
              <Copy className="h-4 w-4" />
              {t.duplicate}
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={targets.size === 0}
              className="flex items-center gap-2 rounded-lg border border-error/30 px-3 py-2 text-sm font-semibold text-error hover:bg-error-soft disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              {t.remove}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelected(new Set(pages.map((p) => p.id)))}
            disabled={pages.length === 0}
            className="self-start text-sm font-semibold text-accent-hover hover:underline disabled:opacity-40"
          >
            {t.selectAll}
          </button>

          {downloaded && <SupportNote t={support} />}

          <div className="hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.shortcutsTitle}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              {t.shortcuts.map(([keys, action]) => (
                <div key={keys} className="contents">
                  <dt>
                    <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]">{keys}</kbd>
                  </dt>
                  <dd className="text-muted">{action}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
