"use client";

import { useRef, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import { format as fill } from "@/lib/i18n";
import { saveBlob } from "@/lib/files";
import { PdfToolError, mergePdfs, pdfPageCount } from "@/lib/pdf-tools";
import FileDropZone from "@/components/FileDropZone";
import OrderedFileList, { moveItem } from "@/components/OrderedFileList";
import SupportNote from "@/components/SupportNote";

type Item = { id: number; file: File; pages: number };

export default function PdfMergeClient({
  t,
  support,
}: {
  t: Dictionary["pdfMerge"]["ui"];
  support: Dictionary["support"];
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const nextId = useRef(0);

  function describe(err: unknown): string {
    if (err instanceof PdfToolError) return fill(t[err.code], { file: err.fileName });
    return t.failed;
  }

  async function addFiles(files: File[]) {
    setError(null);
    for (const file of files) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) continue;
      try {
        // Reading the page count up front also rejects encrypted or broken files early.
        const pages = await pdfPageCount(file);
        setItems((prev) => [...prev, { id: nextId.current++, file, pages }]);
      } catch (err) {
        setError(describe(err));
      }
    }
  }

  async function merge() {
    if (items.length < 2) {
      setError(t.needTwo);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      saveBlob(await mergePdfs(items.map((item) => item.file)), "merged.pdf");
      setDownloaded(true);
    } catch (err) {
      setError(describe(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <FileDropZone title={t.dropTitle} hint={t.dropHint} accept="application/pdf,.pdf" onFiles={addFiles} />
        <OrderedFileList
          entries={items.map((item) => ({
            id: item.id,
            name: item.file.name,
            detail: fill(t.pages, { count: item.pages }),
          }))}
          onMove={(index, direction) => setItems((prev) => moveItem(prev, index, direction))}
          onRemove={(id) => setItems((prev) => prev.filter((item) => item.id !== id))}
          labels={t}
        />
      </div>

      <div className="flex flex-col gap-4 self-start rounded-2xl border border-border-soft bg-background-raised p-6">
        {error && <p className="rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>}
        {items.length < 2 && !error && <p className="text-sm text-muted">{t.needTwo}</p>}
        <button
          type="button"
          onClick={merge}
          disabled={items.length < 2 || working}
          className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
        >
          {working ? t.merging : fill(t.merge, { count: items.length })}
        </button>
        {downloaded && <SupportNote t={support} />}
      </div>
    </div>
  );
}
