"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, Loader2, Search, Upload } from "lucide-react";
import type { Dictionary } from "@/dictionaries";
import type { GoogleFontEntry } from "@/app/api/google-fonts/route";
import {
  STUDIO_FONTS,
  fontCss,
  fontLabel,
  fontsVersion,
  loadGoogleFont,
  loadUploadedFont,
  loadedFonts,
  subscribeFonts,
  type BuiltinFontId,
  type StudioFontId,
} from "@/lib/pdf-studio/fonts";

type T = Dictionary["editPdf"]["ui"]["fontPicker"];

let catalog: Promise<GoogleFontEntry[]> | null = null;
function googleCatalog(): Promise<GoogleFontEntry[]> {
  catalog ??= fetch("/api/google-fonts")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("list"))))
    .catch((err) => {
      catalog = null;
      throw err;
    });
  return catalog;
}

// Tiny stylesheets that load only the letters of each family's name, so the
// list can show every name in its own font cheaply.
const previewed = new Set<string>();
function previewName(family: string) {
  if (previewed.has(family) || typeof document === "undefined") return;
  previewed.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&text=${encodeURIComponent(family)}&display=swap`;
  document.head.appendChild(link);
}

const MAX_RESULTS = 60;

/** Searchable font menu: built-in fonts, fonts loaded this session, all of Google Fonts, or an uploaded file. */
export default function FontPicker({
  value,
  onChange,
  t,
  compact = false,
}: {
  value: StudioFontId;
  onChange: (font: StudioFontId) => void;
  t: T;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [thaiOnly, setThaiOnly] = useState(true);
  const [list, setList] = useState<GoogleFontEntry[] | null>(null);
  const [listError, setListError] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useSyncExternalStore(subscribeFonts, fontsVersion, () => 0);

  useEffect(() => {
    if (!open) return;
    googleCatalog().then(setList, () => setListError(true));
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const builtins = (Object.keys(STUDIO_FONTS) as BuiltinFontId[]).filter((id) => matches(STUDIO_FONTS[id].label));
  const loaded = loadedFonts().filter((f) => matches(f.label));
  const google = useMemo(
    () =>
      (list ?? [])
        .filter((f) => (!thaiOnly || f.t) && (!q || f.f.toLowerCase().includes(q)) && !loaded.some((l) => l.id === `gf:${f.f}`))
        .slice(0, MAX_RESULTS),
    // loaded is derived from the font registry, which re-renders this component when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, thaiOnly, q, loaded.length],
  );

  useEffect(() => {
    if (open) google.forEach((f) => previewName(f.f));
  }, [open, google]);

  function choose(id: StudioFontId) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  async function chooseGoogle(font: GoogleFontEntry) {
    const id = `gf:${font.f}`;
    setError(null);
    setLoadingId(id);
    try {
      await loadGoogleFont(font.f, font.t);
      choose(id);
    } catch {
      setError(t.loadFailed);
    } finally {
      setLoadingId(null);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLoadingId("upload");
    try {
      const font = await loadUploadedFont(file);
      choose(font.id);
    } catch {
      setError(t.uploadFailed);
    } finally {
      setLoadingId(null);
    }
  }

  const row = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${active ? "bg-accent-soft text-accent-hover" : "hover:bg-background"}`;
  const section = "px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted";

  return (
    <div ref={rootRef} className={`relative ${compact ? "" : "w-full"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t.label}
        className={`flex items-center gap-2 rounded-lg border border-border bg-background-raised px-2.5 py-1.5 text-sm hover:border-accent ${compact ? "max-w-[11rem]" : "w-full"}`}
      >
        <span className="min-w-0 flex-1 truncate text-left" style={{ fontFamily: fontCss(value) }}>
          {fontLabel(value)}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.label}
          className="fixed inset-x-2 bottom-2 z-50 flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-border bg-background-raised shadow-2xl lg:absolute lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-full lg:mt-1 lg:max-h-[26rem] lg:w-80"
        >
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 focus-within:border-accent">
              <Search className="h-4 w-4 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (builtins[0]) choose(builtins[0]);
                  else if (loaded[0]) choose(loaded[0].id);
                  else if (google[0]) void chooseGoogle(google[0]);
                }}
                placeholder={t.search}
                className="w-full bg-transparent py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="mt-2 flex gap-1 text-xs font-semibold">
              {[
                [true, t.thaiOnly],
                [false, t.all],
              ].map(([v, label]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setThaiOnly(v as boolean)}
                  className={`rounded-full px-2.5 py-1 ${thaiOnly === v ? "bg-accent text-white" : "bg-background text-muted hover:text-foreground"}`}
                >
                  {label as string}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5" role="listbox">
            {builtins.length > 0 && <p className={section}>{t.builtIn}</p>}
            {builtins.map((id) => (
              <button key={id} type="button" role="option" aria-selected={value === id} onClick={() => choose(id)} className={row(value === id)}>
                <span className="flex-1 truncate" style={{ fontFamily: fontCss(id) }}>
                  {STUDIO_FONTS[id].label}
                </span>
                {value === id && <Check className="h-4 w-4" />}
              </button>
            ))}

            {loaded.length > 0 && <p className={section}>{t.inUse}</p>}
            {loaded.map((f) => (
              <button key={f.id} type="button" role="option" aria-selected={value === f.id} onClick={() => choose(f.id)} className={row(value === f.id)}>
                <span className="flex-1 truncate" style={{ fontFamily: fontCss(f.id) }}>
                  {f.label}
                </span>
                {!f.thai && <span className="rounded bg-background px-1.5 text-[10px] text-muted">{t.noThai}</span>}
                {f.source === "upload" && <span className="rounded bg-background px-1.5 text-[10px] text-muted">{t.uploaded}</span>}
                {value === f.id && <Check className="h-4 w-4" />}
              </button>
            ))}

            <p className={section}>Google Fonts</p>
            {!list && !listError && <p className="px-2.5 py-2 text-sm text-muted">{t.loadingList}</p>}
            {listError && <p className="px-2.5 py-2 text-sm text-error">{t.listFailed}</p>}
            {list && google.length === 0 && <p className="px-2.5 py-2 text-sm text-muted">{t.noResults}</p>}
            {google.map((f) => {
              const id = `gf:${f.f}`;
              return (
                <button key={f.f} type="button" role="option" aria-selected={false} onClick={() => void chooseGoogle(f)} disabled={loadingId !== null} className={row(false)}>
                  <span className="flex-1 truncate" style={{ fontFamily: `'${f.f}', sans-serif` }}>
                    {f.f}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted">{f.c}</span>
                  {!f.t && <span className="rounded bg-background px-1.5 text-[10px] text-muted">{t.noThai}</span>}
                  {loadingId === id && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
                </button>
              );
            })}
            {list && google.length === MAX_RESULTS && <p className="px-2.5 py-2 text-xs text-muted">{t.refine}</p>}
          </div>

          <div className="border-t border-border p-2">
            {error && <p className="mb-2 text-xs font-semibold text-error">{error}</p>}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent-hover">
              {loadingId === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t.upload}
              <input type="file" accept=".ttf,.otf,.woff,font/ttf,font/otf,font/woff" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">{t.sarabunNote}</p>
          </div>
        </div>
      )}
    </div>
  );
}
