"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import { format as fill } from "@/lib/i18n";
import { saveBlob } from "@/lib/files";
import { imagesToPdf, type PageSize } from "@/lib/pdf-tools";
import FileDropZone from "@/components/FileDropZone";
import OrderedFileList, { moveItem } from "@/components/OrderedFileList";
import SupportNote from "@/components/SupportNote";

type Item = { id: number; file: File; thumbnail: string };

const MARGINS = { none: 0, small: 18, large: 36 } as const;
type MarginKey = keyof typeof MARGINS;

const fieldClass =
  "rounded-lg border border-border px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft";

export default function ImagesToPdfClient({
  t,
  support,
}: {
  t: Dictionary["imagesToPdf"]["ui"];
  support: Dictionary["support"];
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [margin, setMargin] = useState<MarginKey>("small");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const nextId = useRef(0);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Free thumbnail object URLs when leaving the page.
  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.thumbnail)), []);

  function addFiles(files: File[]) {
    setError(null);
    const images = files.filter((file) => file.type.startsWith("image/"));
    setItems((prev) => [
      ...prev,
      ...images.map((file) => ({ id: nextId.current++, file, thumbnail: URL.createObjectURL(file) })),
    ]);
  }

  function remove(id: number) {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.thumbnail);
      return prev.filter((item) => item.id !== id);
    });
  }

  async function createPdf() {
    setWorking(true);
    setError(null);
    try {
      const pdf = await imagesToPdf(
        items.map((item) => item.file),
        { pageSize, margin: MARGINS[margin] },
      );
      saveBlob(pdf, "images.pdf");
      setDownloaded(true);
    } catch {
      setError(t.failed);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <FileDropZone title={t.dropTitle} hint={t.dropHint} accept="image/*" onFiles={addFiles} />
        <OrderedFileList
          entries={items.map((item) => ({ id: item.id, name: item.file.name, thumbnail: item.thumbnail }))}
          onMove={(index, direction) => setItems((prev) => moveItem(prev, index, direction))}
          onRemove={remove}
          labels={t}
        />
      </div>

      <div className="flex flex-col gap-4 self-start rounded-2xl border border-border-soft bg-background-raised p-6">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t.pageSize}
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)} className={fieldClass}>
            <option value="a4">{t.sizeA4}</option>
            <option value="letter">{t.sizeLetter}</option>
            <option value="fit">{t.sizeFit}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t.margin}
          <select value={margin} onChange={(e) => setMargin(e.target.value as MarginKey)} className={fieldClass}>
            <option value="none">{t.marginNone}</option>
            <option value="small">{t.marginSmall}</option>
            <option value="large">{t.marginLarge}</option>
          </select>
        </label>

        {error && <p className="rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>}

        <button
          type="button"
          onClick={createPdf}
          disabled={items.length === 0 || working}
          className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
        >
          {working ? t.creating : fill(t.create, { count: items.length })}
        </button>
        {downloaded && <SupportNote t={support} />}
      </div>
    </div>
  );
}
