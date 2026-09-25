import jsQR from "jsqr";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };

let nativeDetector: Promise<Detector | null> | undefined;

/** The browser's built-in QR detector when it has one (Chrome, Edge, Android), else null. */
function getNativeDetector(): Promise<Detector | null> {
  nativeDetector ??= (async () => {
    const Ctor = (globalThis as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } })
      .BarcodeDetector;
    if (!Ctor) return null;
    try {
      const formats = await Ctor.getSupportedFormats();
      return formats.includes("qr_code") ? new Ctor({ formats: ["qr_code"] }) : null;
    } catch {
      return null;
    }
  })();
  return nativeDetector;
}

const scratch = typeof document !== "undefined" ? document.createElement("canvas") : null;

/** Reads a QR code from an image, video frame, or canvas. Returns null if none is found. */
export async function decodeQr(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  width: number,
  height: number,
): Promise<string | null> {
  const native = await getNativeDetector();
  if (native) {
    try {
      const [first] = await native.detect(source);
      if (first) return first.rawValue;
    } catch {
      // Fall through to jsQR.
    }
  }

  if (!scratch || width === 0 || height === 0) return null;
  // jsQR is slow on huge images; scale down so the long edge is at most 1600px.
  const scale = Math.min(1, 1600 / Math.max(width, height));
  scratch.width = Math.round(width * scale);
  scratch.height = Math.round(height * scale);
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, scratch.width, scratch.height);
  const pixels = ctx.getImageData(0, 0, scratch.width, scratch.height);
  return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

export async function decodeQrFromFile(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return await decodeQr(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export type WifiInfo = { ssid: string; password: string; encryption: string; hidden: boolean };

/** Parses the WIFI:T:...;S:...;P:...;; format (with \-escapes) produced by WiFi QR codes. */
export function parseWifi(text: string): WifiInfo | null {
  if (!/^WIFI:/i.test(text)) return null;
  const fields: Record<string, string> = {};
  let key = "";
  let value = "";
  let readingKey = true;
  for (let i = 5; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      value += text[++i];
    } else if (readingKey && ch === ":") {
      readingKey = false;
    } else if (!readingKey && ch === ";") {
      fields[key.toUpperCase()] = value;
      key = "";
      value = "";
      readingKey = true;
    } else if (readingKey) {
      key += ch;
    } else {
      value += ch;
    }
  }
  if (!fields.S) return null;
  return {
    ssid: fields.S,
    password: fields.P ?? "",
    encryption: fields.T || "nopass",
    hidden: fields.H?.toLowerCase() === "true",
  };
}

/** Returns the URL if the text is a web link, else null. */
export function asWebUrl(text: string): URL | null {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
