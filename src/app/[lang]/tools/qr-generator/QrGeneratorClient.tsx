"use client";

import { useCallback, useRef, useState } from "react";
import {
  resolveQrData,
  QrTemplateError,
  type QrType,
  type QrTemplateInput,
} from "@/lib/qr-templates";
import { renderQrToCanvas, renderQrToSvgString, type DotStyle } from "@/lib/qr-render";
import SupportNote from "@/components/SupportNote";
import type { Dictionary } from "@/dictionaries";
import { format } from "@/lib/i18n";

const ERROR_LEVELS = ["L", "M", "Q", "H"] as const;

type ErrorLevel = (typeof ERROR_LEVELS)[number];

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

export default function QrGeneratorClient({
  t,
  support,
}: {
  t: Dictionary["qr"]["ui"];
  support: Dictionary["support"];
}) {
  const qrTypes: { value: QrType; label: string }[] = [
    { value: "text", label: t.typeText },
    { value: "wifi", label: t.typeWifi },
  ];

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [input, setInput] = useState<QrTemplateInput>(DEFAULT_INPUT);
  const [size, setSize] = useState(320);
  const [downloaded, setDownloaded] = useState(false);
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>("M");
  const [fgColor, setFgColor] = useState("#0f172a");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [eyeColor, setEyeColor] = useState("#0f172a");
  const [dotStyle, setDotStyle] = useState<DotStyle>("square");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);

  const update = <K extends keyof QrTemplateInput>(key: K, value: QrTemplateInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const recommendedMinLevel: ErrorLevel | null = logoDataUrl ? "H" : dotStyle === "dots" ? "Q" : null;

  // Bump error correction when a logo or dotted style is picked — only at that
  // moment, so a manual downgrade afterward is respected.
  function raiseErrorLevelFor(hasLogo: boolean, style: DotStyle) {
    const min: ErrorLevel | null = hasLogo ? "H" : style === "dots" ? "Q" : null;
    if (min) setErrorLevel((level) => (ERROR_LEVEL_RANK[level] < ERROR_LEVEL_RANK[min] ? min : level));
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t.errors.logoNotImage);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t.errors.logoTooBig);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(reader.result as string);
      raiseErrorLevelFor(true, dotStyle);
    };
    reader.readAsDataURL(file);
  }

  const generate = useCallback(async () => {
    setError(null);
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
      setError(err instanceof QrTemplateError ? t.errors[err.code] : t.errors.generic);
    } finally {
      setBusy(false);
    }
  }, [input, size, errorLevel, fgColor, bgColor, eyeColor, dotStyle, logoDataUrl, t]);

  function handleDownloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    setDownloaded(true);
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
    setDownloaded(true);
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-border-soft bg-background-raised p-6">
          <div className="flex flex-wrap gap-2">
            {qrTypes.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update("type", option.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  input.type === option.value
                    ? "bg-gradient-to-br from-accent to-accent-2 text-white shadow-sm"
                    : "bg-background text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {input.type === "text" && (
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                {t.textLabel}
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
                <Field label={t.ssid}>
                  <input
                    value={input.wifiSsid}
                    onChange={(e) => update("wifiSsid", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label={t.password}>
                  <input
                    value={input.wifiPassword}
                    onChange={(e) => update("wifiPassword", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label={t.encryption}>
                  <select
                    value={input.wifiEncryption}
                    onChange={(e) =>
                      update("wifiEncryption", e.target.value as QrTemplateInput["wifiEncryption"])
                    }
                    className={fieldClass}
                  >
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">{t.encryptionNone}</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={input.wifiHidden}
                    onChange={(e) => update("wifiHidden", e.target.checked)}
                  />
                  {t.hidden}
                </label>
              </>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label={format(t.size, { size })}>
              <input
                type="range"
                min={160}
                max={640}
                step={10}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </Field>
            <Field label={t.errorCorrection}>
              <select
                value={errorLevel}
                onChange={(e) => setErrorLevel(e.target.value as ErrorLevel)}
                className={fieldClass}
              >
                {ERROR_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t.levels[level]}
                  </option>
                ))}
              </select>
              {recommendedMinLevel && (
                <span className="font-normal text-xs text-muted">
                  {logoDataUrl ? t.raisedForLogo : t.raisedForDots}
                </span>
              )}
            </Field>
            <Field label={t.foreground}>
              <input
                type="color"
                value={fgColor}
                onChange={(e) => setFgColor(e.target.value)}
                className="h-10 w-full rounded-lg border border-border"
              />
            </Field>
            <Field label={t.background}>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-10 w-full rounded-lg border border-border"
              />
            </Field>
            <Field label={t.dotStyle}>
              <select
                value={dotStyle}
                onChange={(e) => {
                  const style = e.target.value as DotStyle;
                  setDotStyle(style);
                  raiseErrorLevelFor(Boolean(logoDataUrl), style);
                }}
                className={fieldClass}
              >
                <option value="square">{t.dotSquare}</option>
                <option value="dots">{t.dotDots}</option>
              </select>
            </Field>
            <Field label={t.eyeColor}>
              <input
                type="color"
                value={eyeColor}
                onChange={(e) => setEyeColor(e.target.value)}
                className="h-10 w-full rounded-lg border border-border"
              />
            </Field>
            <Field label={t.logo}>
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
            {busy ? t.working : t.generate}
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-soft bg-background-raised p-6">
          <canvas
            ref={canvasRef}
            className={`max-w-full rounded-lg ${hasResult ? "" : "hidden"}`}
          />
          {!hasResult && (
            <p className="py-16 text-center text-sm text-muted">
              {t.placeholder}
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
                  {t.downloadPng}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-background"
                >
                  {t.downloadSvg}
                </button>
              </div>
              {downloaded && <SupportNote t={support} className="mt-2" />}
            </div>
          )}
        </div>
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
