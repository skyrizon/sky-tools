"use client";

import { useState } from "react";
import type { Dictionary } from "@/dictionaries";
import { format as fill } from "@/lib/i18n";
import { saveBlob, zipFiles } from "@/lib/files";
import { baseName } from "@/lib/image-convert";
import {
  PdfToolError,
  extractPages,
  parsePageRanges,
  pdfPageCount,
  splitEveryPage,
} from "@/lib/pdf-tools";
import FileDropZone from "@/components/FileDropZone";
import SupportNote from "@/components/SupportNote";

type Mode = "range" | "every";

const fieldClass =
  "rounded-lg border border-border px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft";

export default function PdfSplitClient({
  t,
  support,
}: {
  t: Dictionary["pdfSplit"]["ui"];
  support: Dictionary["support"];
}) {
  const [file, setFile] = useState<{ file: File; pages: number } | null>(null);
  const [mode, setMode] = useState<Mode>("range");
  const [ranges, setRanges] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  function describe(err: unknown): string {
    if (err instanceof PdfToolError) return fill(t[err.code], { file: err.fileName });
    return t.failed;
  }

  async function choose(files: File[]) {
    const picked = files[0];
    if (!picked) return;
    setError(null);
    try {
      const pages = await pdfPageCount(picked);
      setFile({ file: picked, pages });
      setRanges(pages > 1 ? `1-${Math.min(pages, 3)}` : "1");
    } catch (err) {
      setError(describe(err));
    }
  }

  const indices = file && mode === "range" ? parsePageRanges(ranges, file.pages) : null;
  const rangeInvalid = mode === "range" && ranges.trim() !== "" && !indices;

  async function run() {
    if (!file) return;
    setWorking(true);
    setError(null);
    const stem = baseName(file.file.name);
    try {
      if (mode === "range") {
        if (!indices) return;
        saveBlob(await extractPages(file.file, indices), `${stem}-pages.pdf`);
      } else {
        const pages = await splitEveryPage(file.file);
        const archive = await zipFiles(pages.map((data, i) => ({ name: `${stem}-page-${i + 1}.pdf`, data })));
        saveBlob(archive, `${stem}-pages.zip`);
      }
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
        {file ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-soft bg-background-raised p-5">
            <p className="min-w-0 truncate font-semibold">
              {fill(t.fileInfo, { file: file.file.name, count: file.pages })}
            </p>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-sm font-semibold text-accent-hover hover:underline"
            >
              {t.change}
            </button>
          </div>
        ) : (
          <FileDropZone
            title={t.dropTitle}
            hint={t.dropHint}
            accept="application/pdf,.pdf"
            multiple={false}
            onFiles={choose}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 self-start rounded-2xl border border-border-soft bg-background-raised p-6">
        <fieldset className="flex flex-col gap-2 text-sm">
          {(["range", "every"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 font-semibold">
              <input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} />
              {value === "range" ? t.modeRange : t.modeEvery}
            </label>
          ))}
        </fieldset>

        {mode === "range" && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t.ranges}
            <input
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              placeholder={t.rangesHint}
              disabled={!file}
              className={fieldClass}
            />
            <span className={`text-xs font-normal ${rangeInvalid ? "text-error" : "text-muted"}`}>
              {rangeInvalid && file ? fill(t.rangesInvalid, { count: file.pages }) : t.rangesHint}
            </span>
          </label>
        )}

        {error && <p className="rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>}

        <button
          type="button"
          onClick={run}
          disabled={!file || working || (mode === "range" && !indices)}
          className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
        >
          {working ? t.working : mode === "range" ? t.extract : fill(t.split, { count: file?.pages ?? 0 })}
        </button>
        {downloaded && <SupportNote t={support} />}
      </div>
    </div>
  );
}
