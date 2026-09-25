"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Dictionary } from "@/dictionaries";

type T = Dictionary["editPdf"]["ui"]["signature"];
export type SignatureImage = { src: string; width: number; height: number };

const INKS = ["#10151c", "#1d4ed8"];
// Handwriting fonts with Thai and Latin glyphs, loaded by the studio page.
const TYPE_STYLES = ["var(--font-sign-1)", "var(--font-sign-2)"];

/** Crops a canvas to its non-transparent pixels (plus padding) and returns a PNG. */
function trimToPng(canvas: HTMLCanvasElement, pad = 8): SignatureImage | null {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const w = Math.min(width, maxX + pad) - x;
  const h = Math.min(height, maxY + pad) - y;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return { src: out.toDataURL("image/png"), width: w, height: h };
}

export default function SignatureDialog({
  t,
  recent,
  onUse,
  onClose,
}: {
  t: T;
  recent: SignatureImage[];
  onUse: (signature: SignatureImage) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const [ink, setInk] = useState(INKS[0]);
  const [name, setName] = useState("");
  const [typeStyle, setTypeStyle] = useState(0);
  const [uploaded, setUploaded] = useState<SignatureImage | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  }

  function clearDrawing() {
    const c = drawRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  async function renderTyped(): Promise<SignatureImage | null> {
    if (!name.trim()) return null;
    // Resolve the CSS variable inside the dialog, where the studio page defines it.
    const probe = document.createElement("span");
    probe.style.fontFamily = TYPE_STYLES[typeStyle];
    (dialogRef.current ?? document.body).appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();
    await document.fonts.load(`96px ${family}`, name);
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 320;
    const ctx = canvas.getContext("2d")!;
    ctx.font = `96px ${family}`;
    ctx.fillStyle = ink;
    ctx.textBaseline = "middle";
    ctx.fillText(name, 40, 160);
    return trimToPng(canvas, 12);
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    // Make a white or near-white background transparent, so a scanned signature sits on the page.
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) d[i + 3] = 0;
    }
    ctx.putImageData(image, 0, 0);
    setUploaded(trimToPng(canvas, 4));
  }

  async function use() {
    const result =
      tab === "draw" ? (drawRef.current ? trimToPng(drawRef.current) : null) : tab === "type" ? await renderTyped() : uploaded;
    if (result) onUse(result);
  }

  const canUse = tab === "draw" ? hasInk : tab === "type" ? name.trim() !== "" : uploaded !== null;
  const tabButton = (value: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === value ? "bg-accent-soft text-accent-hover" : "text-muted hover:text-foreground"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t.title} className="w-full max-w-xl rounded-2xl bg-background-raised p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.title}</h2>
          <button type="button" onClick={onClose} aria-label={t.cancel} className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex gap-1">
          {tabButton("draw", t.draw)}
          {tabButton("type", t.type)}
          {tabButton("upload", t.upload)}
          {tab !== "upload" && (
            <div className="ml-auto flex items-center gap-1.5">
              {INKS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setInk(c)}
                  className={`h-6 w-6 rounded-full border-2 ${ink === c ? "border-accent" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-3">
          {tab === "draw" && (
            <>
              <canvas
                ref={drawRef}
                width={1000}
                height={320}
                className="h-40 w-full touch-none rounded-xl border border-dashed border-border bg-white"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  last.current = pos(e);
                }}
                onPointerMove={(e) => {
                  if (!last.current) return;
                  const p = pos(e);
                  const ctx = e.currentTarget.getContext("2d")!;
                  ctx.strokeStyle = ink;
                  ctx.lineWidth = 5;
                  ctx.lineCap = "round";
                  ctx.lineJoin = "round";
                  ctx.beginPath();
                  ctx.moveTo(last.current.x, last.current.y);
                  ctx.lineTo(p.x, p.y);
                  ctx.stroke();
                  last.current = p;
                  setHasInk(true);
                }}
                onPointerUp={() => (last.current = null)}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>{t.drawHint}</span>
                <button type="button" onClick={clearDrawing} className="font-semibold text-accent-hover hover:underline">
                  {t.clear}
                </button>
              </div>
            </>
          )}

          {tab === "type" && (
            <div className="flex flex-col gap-3">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.typePlaceholder}
                className="rounded-lg border border-border px-3 py-2.5 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {TYPE_STYLES.map((family, i) => (
                  <button
                    key={family}
                    type="button"
                    onClick={() => setTypeStyle(i)}
                    className={`h-20 truncate rounded-xl border-2 bg-white px-3 text-3xl ${typeStyle === i ? "border-accent" : "border-border"}`}
                    style={{ fontFamily: family, color: ink }}
                  >
                    {name || t.typePlaceholder}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-white p-4">
              {uploaded ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploaded.src} alt="" className="max-h-32 max-w-full" />
              ) : (
                <p className="text-sm text-muted">{t.uploadHint}</p>
              )}
              <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent-hover">
                {t.chooseFile}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void uploadFile(e.target.files?.[0])} />
              </label>
            </div>
          )}
        </div>

        {recent.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted">{t.recent}</p>
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {recent.map((sig) => (
                <button key={sig.src} type="button" onClick={() => onUse(sig)} className="shrink-0 rounded-lg border border-border bg-white p-1.5 hover:border-accent">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sig.src} alt="" className="h-10 max-w-40 object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-muted hover:text-foreground">
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => void use()}
            disabled={!canUse}
            className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-50"
          >
            {t.place}
          </button>
        </div>
      </div>
    </div>
  );
}
