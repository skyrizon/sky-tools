"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, GripVertical, Plus, RotateCcw, RotateCw, Trash2, X } from "lucide-react";
import type { Dictionary } from "@/dictionaries";
import { format as fill } from "@/lib/i18n";
import type { StudioPage } from "@/lib/pdf-studio/types";
import PageThumb from "./PageThumb";

type T = Dictionary["editPdf"]["ui"];

type Drag = {
  ids: number[];
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
};

/**
 * Full-window page organizer: a grid of every page that can be reordered by
 * dragging (mouse anywhere on a card, touch by its grip), multi-selected, and
 * rotated, duplicated, or deleted in bulk. Clicking a page opens it.
 */
export default function PageOrganizer({
  t,
  pages,
  imageFor,
  currentId,
  selected,
  onSelectedChange,
  onOpen,
  onReorder,
  onRotate,
  onDuplicate,
  onDelete,
  onAddFiles,
  onClose,
}: {
  t: T;
  pages: StudioPage[];
  imageFor: (page: StudioPage) => string | undefined;
  currentId: number | null;
  selected: Set<number>;
  onSelectedChange: (next: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  onOpen: (id: number) => void;
  /** Moves the pages with these ids so they start at `insertBefore` (an index into `pages`). */
  onReorder: (ids: number[], insertBefore: number) => void;
  onRotate: (by: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddFiles: (files: File[]) => void;
  onClose: () => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const anchor = useRef(0);
  const suppressClick = useRef(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Drag tracking on the window so the pointer can leave the card.
  useEffect(() => {
    if (!drag) return;
    const d = drag;

    function onMove(e: PointerEvent) {
      if (e.pointerId !== d.pointerId) return;
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (!d.active && moved < 6) return;
      e.preventDefault();
      setDrag({ ...d, x: e.clientX, y: e.clientY, active: true });

      // Where would the pages land? Before or after the card under the pointer.
      const card = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-org-index]");
      if (card) {
        const index = Number(card.dataset.orgIndex);
        const r = card.getBoundingClientRect();
        setDropIndex(e.clientX < r.left + r.width / 2 ? index : index + 1);
      }

      // Scroll the grid when dragging near its top or bottom edge.
      const grid = gridRef.current;
      if (grid) {
        const g = grid.getBoundingClientRect();
        if (e.clientY < g.top + 60) grid.scrollBy(0, -14);
        else if (e.clientY > g.bottom - 60) grid.scrollBy(0, 14);
      }
    }

    function onUp(e: PointerEvent) {
      if (e.pointerId !== d.pointerId) return;
      if (d.active) {
        // Swallow the click that may follow this pointerup, but only that one.
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
        if (dropIndex !== null) onReorder(d.ids, dropIndex);
      }
      setDrag(null);
      setDropIndex(null);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, dropIndex, onReorder]);

  function startDrag(e: React.PointerEvent, page: StudioPage, fromHandle: boolean) {
    // Touch drags only start from the grip, so the grid can still be scrolled with a finger.
    if (e.button !== 0 || (e.pointerType !== "mouse" && !fromHandle)) return;
    const ids = selected.has(page.id) && selected.size > 1 ? pages.filter((p) => selected.has(p.id)).map((p) => p.id) : [page.id];
    setDrag({ ids, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: fromHandle && e.pointerType !== "mouse" });
  }

  function clickCard(e: React.MouseEvent, page: StudioPage, index: number) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (e.shiftKey) {
      const [from, to] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
      onSelectedChange(new Set(pages.slice(from, to + 1).map((p) => p.id)));
    } else if (e.ctrlKey || e.metaKey) {
      toggle(page.id);
      anchor.current = index;
    } else {
      onOpen(page.id);
    }
  }

  function toggle(id: number) {
    onSelectedChange((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const count = selected.size;
  const barButton =
    "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background-raised px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent-hover disabled:opacity-40 disabled:hover:border-border disabled:hover:text-inherit";
  const dragging = drag?.active ? drag : null;

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-foreground/40 p-0 sm:p-6" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={t.organizer.title} className="flex w-full max-w-6xl flex-col overflow-hidden bg-background shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background-raised px-4 py-3">
          <div className="mr-auto min-w-0">
            <h2 className="text-lg font-bold">{t.organizer.title}</h2>
            <p className="text-xs text-muted">
              {count > 0 ? fill(t.selectedCount, { count }) : fill(t.pageCount, { count: pages.length })} · {t.organizer.hint}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.organizer.close} className="rounded-lg p-2 text-muted hover:bg-background hover:text-foreground sm:order-last">
            <X className="h-5 w-5" />
          </button>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className={`${barButton} cursor-pointer`}>
              <Plus className="h-4 w-4" />
              {t.organizer.add}
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length) onAddFiles(files);
                }}
              />
            </label>
            <button type="button" onClick={() => onRotate(-90)} disabled={count === 0} className={barButton} title={t.rotateLeft} aria-label={t.rotateLeft}>
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onRotate(90)} disabled={count === 0} className={barButton} title={t.rotateRight} aria-label={t.rotateRight}>
              <RotateCw className="h-4 w-4" />
            </button>
            <button type="button" onClick={onDuplicate} disabled={count === 0} className={barButton}>
              <Copy className="h-4 w-4" />
              <span className="hidden md:inline">{t.duplicate}</span>
            </button>
            <button type="button" onClick={onDelete} disabled={count === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-error/30 bg-background-raised px-3 py-2 text-sm font-semibold text-error hover:bg-error-soft disabled:opacity-40">
              <Trash2 className="h-4 w-4" />
              <span className="hidden md:inline">{t.remove}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectedChange(count === pages.length ? new Set() : new Set(pages.map((p) => p.id)))}
              className="px-2 text-sm font-semibold text-accent-hover hover:underline"
            >
              {count === pages.length ? t.organizer.clearSelection : t.selectAll}
            </button>
          </div>
        </div>

        {/* Grid */}
        <div ref={gridRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
          {pages.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">{t.empty}</p>
          ) : (
            <ol className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {pages.map((page, i) => {
                const isSelected = selected.has(page.id);
                const isMoving = dragging?.ids.includes(page.id);
                return (
                  <li key={page.id} data-org-index={i} className="relative">
                    {/* Drop indicator */}
                    {dragging && dropIndex === i && <span className="absolute -left-2.5 top-0 bottom-6 w-1 rounded-full bg-accent" />}
                    {dragging && dropIndex === pages.length && i === pages.length - 1 && (
                      <span className="absolute -right-2.5 top-0 bottom-6 w-1 rounded-full bg-accent" />
                    )}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={fill(t.pageLabel, { page: i + 1 })}
                      aria-pressed={isSelected}
                      onPointerDown={(e) => startDrag(e, page, false)}
                      onClick={(e) => clickCard(e, page, i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onOpen(page.id);
                        if (e.key === " ") {
                          e.preventDefault();
                          toggle(page.id);
                        }
                      }}
                      className={`group relative flex cursor-pointer select-none flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition ${isMoving ? "opacity-30" : ""} ${
                        isSelected ? "border-accent bg-accent-soft" : page.id === currentId ? "border-accent/40 bg-background-raised" : "border-transparent bg-background-raised hover:border-border"
                      }`}
                    >
                      <PageThumb page={page} src={imageFor(page)} />
                      <span className={`text-xs font-semibold ${page.id === currentId ? "text-accent-hover" : "text-muted"}`}>{i + 1}</span>

                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(page.id)}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label={fill(t.pageLabel, { page: i + 1 })}
                        className={`absolute left-3 top-3 h-4 w-4 accent-accent ${isSelected ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
                      />
                      <span
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          startDrag(e, page, true);
                        }}
                        className="absolute right-2 top-2 touch-none rounded-md bg-background-raised/90 p-1 text-muted shadow-sm"
                        aria-hidden="true"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="flex justify-end border-t border-border bg-background-raised px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-5 py-2 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105">
            {t.organizer.done}
          </button>
        </div>
      </div>

      {/* The card(s) following the pointer while dragging */}
      {dragging && (
        <div className="pointer-events-none fixed z-50 w-28 -translate-x-1/2 -translate-y-1/2" style={{ left: dragging.x, top: dragging.y }}>
          {(() => {
            const page = pages.find((p) => p.id === dragging.ids[0]);
            return page ? (
              <div className="relative rotate-3 rounded-xl border-2 border-accent bg-background-raised p-1.5 shadow-2xl">
                <PageThumb page={page} src={imageFor(page)} />
                {dragging.ids.length > 1 && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{dragging.ids.length}</span>
                )}
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}
