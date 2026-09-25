import type { Rect } from "@/lib/pdf-studio/types";

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/**
 * Reads the colors around and inside a text line from a rendered page image,
 * so replacement text can match the original: `background` from a ring just
 * outside the box, `foreground` from the inked pixels that differ most from it.
 */
export async function sampleTextColors(
  imageUrl: string,
  pageSize: { w: number; h: number },
  box: Rect,
): Promise<{ background: string; foreground: string }> {
  const fallback = { background: "#ffffff", foreground: "#000000" };
  const img = new Image();
  img.src = imageUrl;
  try {
    await img.decode();
  } catch {
    return fallback;
  }
  const scale = img.naturalWidth / pageSize.w;
  const pad = 3;
  const x0 = Math.max(0, Math.floor((box.x - pad) * scale));
  const y0 = Math.max(0, Math.floor((box.y - pad) * scale));
  const x1 = Math.min(img.naturalWidth - 1, Math.ceil((box.x + box.w + pad) * scale));
  const y1 = Math.min(img.naturalHeight - 1, Math.ceil((box.y + box.h + pad) * scale));
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 2 || h < 2) return fallback;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };

  // Background: the edge ring of the sampled area.
  const ring: (readonly [number, number, number])[] = [];
  for (let x = 0; x < w; x++) ring.push(px(x, 0), px(x, h - 1));
  for (let y = 0; y < h; y++) ring.push(px(0, y), px(w - 1, y));
  // The brightest half of the ring avoids neighbouring text leaking in.
  ring.sort((a, b) => b[0] + b[1] + b[2] - (a[0] + a[1] + a[2]));
  const bright = ring.slice(0, Math.max(1, Math.floor(ring.length / 2)));
  const bg = [0, 1, 2].map((c) => bright.reduce((s, p) => s + p[c], 0) / bright.length);

  // Foreground: the pixels inside that differ most from the background.
  const inside: { p: readonly [number, number, number]; d: number }[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = px(x, y);
      inside.push({ p, d: Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) });
    }
  }
  inside.sort((a, b) => b.d - a.d);
  const ink = inside.slice(0, Math.max(1, Math.floor(inside.length * 0.05)));
  if (ink.length === 0 || ink[0].d < 60) return { background: toHex(bg[0], bg[1], bg[2]), foreground: "#000000" };
  const fg = [0, 1, 2].map((c) => ink.reduce((s, q) => s + q.p[c], 0) / ink.length);
  return { background: toHex(bg[0], bg[1], bg[2]), foreground: toHex(fg[0], fg[1], fg[2]) };
}
