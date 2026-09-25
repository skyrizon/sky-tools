"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import { format as fill } from "@/lib/i18n";
import { formatBytes, saveBlob, zipFiles } from "@/lib/files";
import {
  OUTPUT_FORMATS,
  baseName,
  convertImage,
  sameFormatAs,
  type ImageOutputFormat,
} from "@/lib/image-convert";
import FileDropZone from "@/components/FileDropZone";
import SupportNote from "@/components/SupportNote";

type Item = {
  id: number;
  file: File;
  status: "pending" | "done" | "error";
  blob?: Blob;
  format?: ImageOutputFormat;
};

const MAX_EDGES = [0, 3840, 2560, 1920, 1280, 800] as const;
type FormatChoice = "keep" | ImageOutputFormat;

const fieldClass =
  "rounded-lg border border-border px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft";

export default function ImageCompressorClient({
  t,
  support,
}: {
  t: Dictionary["compressor"]["ui"];
  support: Dictionary["support"];
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [maxEdge, setMaxEdge] = useState<number>(1920);
  const [formatChoice, setFormatChoice] = useState<FormatChoice>("keep");
  const [quality, setQuality] = useState(0.75);
  const [zipping, setZipping] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const nextId = useRef(0);
  const busy = useRef(false);
  const settings = `${maxEdge}|${formatChoice}|${quality}`;
  // Latest settings, updated in the change handler so an in-flight job can tell it is stale.
  const settingsRef = useRef(settings);

  function outputFormat(file: File): ImageOutputFormat {
    return formatChoice === "keep" ? sameFormatAs(file) : formatChoice;
  }

  function addFiles(files: File[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    setItems((prev) => [
      ...prev,
      ...images.map((file) => ({ id: nextId.current++, file, status: "pending" as const })),
    ]);
  }

  function changeSettings(next: { maxEdge?: number; formatChoice?: FormatChoice; quality?: number }) {
    const edge = next.maxEdge ?? maxEdge;
    const choice = next.formatChoice ?? formatChoice;
    const q = next.quality ?? quality;
    setMaxEdge(edge);
    setFormatChoice(choice);
    setQuality(q);
    settingsRef.current = `${edge}|${choice}|${q}`;
    setItems((prev) => prev.map((item) => ({ ...item, status: "pending" })));
  }

  // Compress pending images one at a time; results from outdated settings are redone.
  useEffect(() => {
    if (busy.current) return;
    const item = items.find((i) => i.status === "pending");
    if (!item) return;

    busy.current = true;
    const started = settings;
    const format = outputFormat(item.file);
    convertImage(item.file, format, quality, { maxEdge: maxEdge || undefined }).then(
      (blob) => {
        busy.current = false;
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== item.id) return i;
            if (started !== settingsRef.current) return { ...i };
            return { ...i, status: "done", blob, format };
          }),
        );
      },
      () => {
        busy.current = false;
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "error" } : i)));
      },
    );
    // outputFormat reads formatChoice, which is part of `settings`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, settings]);

  function fileName(item: Item) {
    const ext = OUTPUT_FORMATS.find((f) => f.value === item.format)?.ext ?? "jpg";
    return `${baseName(item.file.name)}.${ext}`;
  }

  const done = items.filter((item) => item.status === "done" && item.blob);
  const totalBefore = done.reduce((sum, item) => sum + item.file.size, 0);
  const totalAfter = done.reduce((sum, item) => sum + item.blob!.size, 0);
  const pngOnly =
    formatChoice === "image/png" ||
    (formatChoice === "keep" && items.length > 0 && items.every((i) => i.file.type === "image/png"));

  async function downloadAll() {
    if (done.length === 1) {
      saveBlob(done[0].blob!, fileName(done[0]));
      setDownloaded(true);
      return;
    }
    setZipping(true);
    try {
      const archive = await zipFiles(done.map((item) => ({ name: fileName(item), data: item.blob! })));
      saveBlob(archive, "compressed-images.zip");
      setDownloaded(true);
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <FileDropZone title={t.dropTitle} hint={t.dropHint} accept="image/*" onFiles={addFiles} />

        {items.length > 0 && (
          <ul className="mt-6 flex flex-col gap-3">
            {items.map((item) => {
              const saved = item.blob ? Math.round((1 - item.blob.size / item.file.size) * 100) : 0;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-border-soft bg-background-raised p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.file.name}</p>
                    <p className="text-xs text-muted">
                      {formatBytes(item.file.size)}
                      {item.status === "done" && item.blob && (
                        <>
                          {" → "}
                          {formatBytes(item.blob.size)}
                          {" · "}
                          {saved > 0 ? (
                            <span className="font-semibold text-accent-hover">{fill(t.saved, { percent: saved })}</span>
                          ) : (
                            <span className="text-error">{t.larger}</span>
                          )}
                        </>
                      )}
                      {item.status === "pending" && ` · ${t.compressing}`}
                      {item.status === "error" && <span className="text-error"> · {t.failed}</span>}
                    </p>
                  </div>
                  {item.status === "done" && (
                    <button
                      type="button"
                      onClick={() => {
                        saveBlob(item.blob!, fileName(item));
                        setDownloaded(true);
                      }}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-background"
                    >
                      {t.download}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                    className="shrink-0 text-sm font-semibold text-error hover:underline"
                  >
                    {t.remove}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-4 self-start rounded-2xl border border-border-soft bg-background-raised p-6">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t.maxSize}
          <select
            value={maxEdge}
            onChange={(e) => changeSettings({ maxEdge: Number(e.target.value) })}
            className={fieldClass}
          >
            {MAX_EDGES.map((edge) => (
              <option key={edge} value={edge}>
                {edge === 0 ? t.maxSizeOriginal : fill(t.maxSizePx, { px: edge })}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t.format}
          <select
            value={formatChoice}
            onChange={(e) => changeSettings({ formatChoice: e.target.value as FormatChoice })}
            className={fieldClass}
          >
            <option value="keep">{t.formatKeep}</option>
            {OUTPUT_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {fill(t.quality, { quality: Math.round(quality * 100) })}
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={quality}
            onChange={(e) => changeSettings({ quality: Number(e.target.value) })}
            disabled={pngOnly}
          />
          {pngOnly && <span className="text-xs font-normal text-muted">{t.qualityPngHint}</span>}
        </label>

        {done.length > 0 && (
          <p className="text-sm text-muted">
            {fill(t.total, { before: formatBytes(totalBefore), after: formatBytes(totalAfter) })}
          </p>
        )}

        <button
          type="button"
          onClick={downloadAll}
          disabled={done.length === 0 || zipping}
          className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
        >
          {zipping
            ? t.preparingZip
            : fill(done.length > 1 ? t.downloadAllZip : t.downloadAll, { count: done.length })}
        </button>
        {downloaded && <SupportNote t={support} />}
      </div>
    </div>
  );
}
