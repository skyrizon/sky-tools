"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  resolveQrData,
  QrTemplateError,
  type QrType,
  type QrTemplateInput,
} from "@/lib/qr-templates";
import { renderQrToCanvas, renderQrToSvgString, type DotStyle } from "@/lib/qr-render";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";

const QR_TYPES: { value: QrType; label: string }[] = [
  { value: "text", label: "Text / URL" },
  { value: "wifi", label: "WiFi" },
];

const ERROR_LEVELS = [
  { value: "L", label: "Low (7%)" },
  { value: "M", label: "Medium (15%)" },
  { value: "Q", label: "Quartile (25%)" },
  { value: "H", label: "High (30%)" },
] as const;

type ErrorLevel = (typeof ERROR_LEVELS)[number]["value"];

const ERROR_LEVEL_RANK: Record<ErrorLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };

const DEFAULT_INPUT: QrTemplateInput = {
  type: "text",
  data: "",
  wifiSsid: "",
  wifiPassword: "",
  wifiEncryption: "WPA",
  wifiHidden: false,
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image file."));
    img.src = dataUrl;
  });
}

export default function QrGeneratorClient() {
  const { data: session } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [input, setInput] = useState<QrTemplateInput>(DEFAULT_INPUT);
  const [size, setSize] = useState(320);
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>("M");
  const [fgColor, setFgColor] = useState("#0f172a");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [eyeColor, setEyeColor] = useState("#0f172a");
  const [dotStyle, setDotStyle] = useState<DotStyle>("square");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);

  const update = <K extends keyof QrTemplateInput>(key: K, value: QrTemplateInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const recommendedMinLevel: ErrorLevel | null = logoDataUrl ? "H" : dotStyle === "dots" ? "Q" : null;

  useEffect(() => {
    if (recommendedMinLevel && ERROR_LEVEL_RANK[errorLevel] < ERROR_LEVEL_RANK[recommendedMinLevel]) {
      setErrorLevel(recommendedMinLevel);
    }
    // Only bump when the logo or dot style actually changes — never fight a manual downgrade afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoDataUrl, dotStyle]);

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo image must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  const generate = useCallback(async () => {
    setError(null);
    setSaveMessage(null);
    setBusy(true);
    try {
      const data = resolveQrData(input);
      const canvas = canvasRef.current;
      if (!canvas) return;

      renderQrToCanvas(canvas, data, {
        size,
        errorCorrectionLevel: errorLevel,
        moduleColor: fgColor,
        backgroundColor: bgColor,
        eyeColor,
        dotStyle,
      });

      if (logoDataUrl) {
        const ctx = canvas.getContext("2d");
        const img = await loadImage(logoDataUrl);
        if (ctx) {
          const logoSize = Math.round(size * 0.28);
          const x = (size - logoSize) / 2;
          const y = (size - logoSize) / 2;
          const pad = Math.round(logoSize * 0.12);
          ctx.fillStyle = bgColor;
          ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
          ctx.drawImage(img, x, y, logoSize, logoSize);
        }
      }

      setLastData(data);
      setHasResult(true);
    } catch (err) {
      setHasResult(false);
      setLastData(null);
      setError(err instanceof QrTemplateError ? err.message : "Could not generate that QR code.");
    } finally {
      setBusy(false);
    }
  }, [input, size, errorLevel, fgColor, bgColor, eyeColor, dotStyle, logoDataUrl]);

  function handleDownloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function handleDownloadSvg() {
    if (!lastData) return;
    const svg = renderQrToSvgString(
      lastData,
      { size, errorCorrectionLevel: errorLevel, moduleColor: fgColor, backgroundColor: bgColor, eyeColor, dotStyle },
      logoDataUrl,
    );
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "qrcode.svg";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !session?.user) return;
    setSaveMessage(null);
    setBusy(true);
    try {
      const dataText = resolveQrData(input);
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataText,
          size,
          errorCorrection: errorLevel,
          foregroundColor: fgColor,
          backgroundColor: bgColor,
          hasLogo: Boolean(logoDataUrl),
          pngDataUri: canvas.toDataURL("image/png"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save this QR code.");
      }
      setSaveMessage("Saved to your history.");
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Could not save this QR code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">QR Code Generator</h1>
      <p className="mt-1 text-muted">Text, links, or WiFi — generated instantly in your browser.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border-soft bg-background-raised p-6">
          <div className="flex flex-wrap gap-2">
            {QR_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => update("type", t.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  input.type === t.value
                    ? "bg-gradient-to-br from-accent to-accent-2 text-white shadow-sm"
                    : "bg-background text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {input.type === "text" && (
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Text or URL
                <textarea
                  value={input.data}
                  onChange={(e) => update("data", e.target.value)}
                  rows={4}
                  placeholder="https://example.com"
                  className="rounded-lg border border-border px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft"
                />
              </label>
            )}

            {input.type === "wifi" && (
              <>
                <Field label="Network name (SSID)">
                  <input
                    value={input.wifiSsid}
                    onChange={(e) => update("wifiSsid", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Password">
                  <input
                    value={input.wifiPassword}
                    onChange={(e) => update("wifiPassword", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Encryption">
                  <select
                    value={input.wifiEncryption}
                    onChange={(e) =>
                      update("wifiEncryption", e.target.value as QrTemplateInput["wifiEncryption"])
                    }
                    className={fieldClass}
                  >
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={input.wifiHidden}
                    onChange={(e) => update("wifiHidden", e.target.checked)}
                  />
                  Hidden network
                </label>
              </>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label={`Size (${size}px)`}>
              <input
                type="range"
                min={160}
                max={640}
                step={10}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </Field>
            <Field label="Error correction">
              <select
                value={errorLevel}
                onChange={(e) => setErrorLevel(e.target.value as ErrorLevel)}
                className={fieldClass}
              >
                {ERROR_LEVELS.map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </option>
                ))}
              </select>
              {recommendedMinLevel && (
                <span className="font-normal text-xs text-muted">
                  Raised automatically — {logoDataUrl ? "a logo needs" : "dot style needs"} more
                  error correction to stay scannable.
                </span>
              )}
            </Field>
            <Field label="Foreground color">
              <input
                type="color"
                value={fgColor}
                onChange={(e) => setFgColor(e.target.value)}
                className="h-10 w-full rounded-lg border border-border"
              />
            </Field>
            <Field label="Background color">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-10 w-full rounded-lg border border-border"
              />
            </Field>
            <Field label="Dot style">
              <select
                value={dotStyle}
                onChange={(e) => setDotStyle(e.target.value as DotStyle)}
                className={fieldClass}
              >
                <option value="square">Square</option>
                <option value="dots">Dots</option>
              </select>
            </Field>
            <Field label="Eye color">
              <input
                type="color"
                value={eyeColor}
                onChange={(e) => setEyeColor(e.target.value)}
                className="h-10 w-full rounded-lg border border-border"
              />
            </Field>
            <Field label="Logo (optional)">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-sm" />
            </Field>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="mt-6 rounded-lg bg-gradient-to-br from-accent to-accent-2 px-5 py-2.5 font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
          >
            {busy ? "Working…" : "Generate QR code"}
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-soft bg-background-raised p-6">
          <canvas
            ref={canvasRef}
            className={`max-w-full rounded-lg ${hasResult ? "" : "hidden"}`}
          />
          {!hasResult && (
            <p className="py-16 text-center text-sm text-muted">
              Your generated QR code will appear here.
            </p>
          )}

          {hasResult && (
            <div className="flex w-full flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-background"
                >
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-background"
                >
                  Download SVG
                </button>
              </div>
              {session?.user ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy}
                  className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent-hover hover:bg-accent-soft disabled:opacity-60"
                >
                  Save to my history
                </button>
              ) : (
                <p className="text-center text-xs text-muted">
                  Log in to save this QR code to your history.
                </p>
              )}
              {saveMessage && <p className="text-center text-xs text-muted">{saveMessage}</p>}
            </div>
          )}
        </div>
      </div>

      <AdSlot slot={AD_SLOTS.toolPageBottom} className="mt-10" />
    </div>
  );
}

const fieldClass =
  "rounded-lg border border-border px-3 py-2.5 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}
