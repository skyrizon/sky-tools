"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Copy, ExternalLink } from "lucide-react";
import type { Dictionary } from "@/dictionaries";
import { format as fill } from "@/lib/i18n";
import { asWebUrl, decodeQr, decodeQrFromFile, parseWifi } from "@/lib/qr-scan";
import FileDropZone from "@/components/FileDropZone";
import SupportNote from "@/components/SupportNote";

type Status = "idle" | "reading" | "camera" | "notFound" | "cameraError";

export default function QrScannerClient({
  t,
  support,
}: {
  t: Dictionary["qrScanner"]["ui"];
  support: Dictionary["support"];
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const showResult = useCallback(
    (text: string) => {
      stopCamera();
      setResult(text);
      setCopied(false);
      setStatus("idle");
    },
    [stopCamera],
  );

  const scanFile = useCallback(
    async (file: File | Blob) => {
      stopCamera();
      setResult(null);
      setStatus("reading");
      try {
        const text = await decodeQrFromFile(file);
        if (text) showResult(text);
        else setStatus("notFound");
      } catch {
        setStatus("notFound");
      }
    },
    [showResult, stopCamera],
  );

  // Ctrl+V / ⌘V anywhere on the page scans a pasted image.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const image = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (image) {
        event.preventDefault();
        void scanFile(image);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [scanFile]);

  // Always release the camera when leaving the page.
  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setStatus("camera");
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      let scanning = false;
      timerRef.current = window.setInterval(async () => {
        if (scanning || video.readyState < 2) return;
        scanning = true;
        try {
          const text = await decodeQr(video, video.videoWidth, video.videoHeight);
          if (text) showResult(text);
        } finally {
          scanning = false;
        }
      }, 250);
    } catch {
      stopCamera();
      setStatus("cameraError");
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
  }

  const url = result ? asWebUrl(result) : null;
  const wifi = result ? parseWifi(result) : null;

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <FileDropZone
          title={t.dropTitle}
          hint={t.dropHint}
          accept="image/*"
          multiple={false}
          onFiles={(files) => void scanFile(files[0])}
        />

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border-soft bg-background-raised p-4">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`w-full max-w-md rounded-lg bg-black ${status === "camera" ? "" : "hidden"}`}
          />
          {status === "camera" ? (
            <>
              <p className="text-sm text-muted">{t.scanning}</p>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setStatus("idle");
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-background"
              >
                {t.stopCamera}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent-hover"
            >
              <Camera className="h-4 w-4" strokeWidth={1.75} />
              {t.camera}
            </button>
          )}
        </div>
      </div>

      <div
        className={`flex flex-col gap-4 self-start rounded-2xl border border-border-soft bg-background-raised p-6 ${
          result || status === "reading" || status === "notFound" || status === "cameraError" ? "" : "hidden lg:flex"
        }`}
      >
        <h2 className="font-bold">{t.result}</h2>

        {status === "reading" && <p className="text-sm text-muted">{t.reading}</p>}
        {status === "notFound" && (
          <p className="rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{t.notFound}</p>
        )}
        {status === "cameraError" && (
          <p className="rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{t.cameraError}</p>
        )}

        {result && (
          <>
            {wifi ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="col-span-2 font-semibold">{t.wifiTitle}</dt>
                <dt className="text-muted">{t.wifiSsid}</dt>
                <dd className="break-all font-mono">{wifi.ssid}</dd>
                <dt className="text-muted">{t.wifiPassword}</dt>
                <dd className="break-all font-mono">{wifi.password || "—"}</dd>
                <dt className="text-muted">{t.wifiSecurity}</dt>
                <dd>{wifi.encryption === "nopass" ? t.wifiNone : wifi.encryption}</dd>
              </dl>
            ) : (
              <p className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background p-3 font-mono text-sm">
                {result}
              </p>
            )}

            {url && (
              <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-foreground">
                {fill(t.linkWarning, { host: url.host })}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-background"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t.copied : t.copy}
              </button>
              {url && (
                <a
                  href={url.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t.openLink}
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setStatus("idle");
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-accent-hover hover:underline"
              >
                {t.scanAnother}
              </button>
            </div>

            <SupportNote t={support} generic />
          </>
        )}
      </div>
    </div>
  );
}
