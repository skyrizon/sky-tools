"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";

export type OrderedEntry = { id: number; name: string; detail?: string; thumbnail?: string };

/** A file list whose order matters (pages in a PDF), with move up/down and remove. */
export default function OrderedFileList({
  entries,
  onMove,
  onRemove,
  labels,
}: {
  entries: OrderedEntry[];
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: number) => void;
  labels: { moveUp: string; moveDown: string; remove: string };
}) {
  if (entries.length === 0) return null;

  const iconButton =
    "rounded-lg p-2 text-muted hover:bg-background hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <ol className="mt-6 flex flex-col gap-3">
      {entries.map((entry, index) => (
        <li
          key={entry.id}
          className="flex items-center gap-3 rounded-xl border border-border-soft bg-background-raised p-3"
        >
          <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted">{index + 1}</span>
          {entry.thumbnail && (
            // Object URL of a local file; next/image can't optimise those.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-md border border-border-soft object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{entry.name}</p>
            {entry.detail && <p className="text-xs text-muted">{entry.detail}</p>}
          </div>
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={labels.moveUp}
            title={labels.moveUp}
            className={iconButton}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === entries.length - 1}
            aria-label={labels.moveDown}
            title={labels.moveDown}
            className={iconButton}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            aria-label={labels.remove}
            title={labels.remove}
            className="rounded-lg p-2 text-error hover:bg-error-soft"
          >
            <X className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Returns a copy of `list` with the item at `index` moved one step in `direction`. */
export function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
