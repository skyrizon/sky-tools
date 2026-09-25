/**
 * Conversions between display coordinates (points, top-left origin, the page
 * rotated clockwise by `rotation` the way viewers show it) and PDF user space
 * (points, bottom-left origin) inside a page box.
 */

export type Box = { x: number; y: number; width: number; height: number };

export function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  return ((((Math.round(rotation / 90) * 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}

/** Size of the box as displayed at this rotation. */
export function displaySize(box: Box, rotation: number): { w: number; h: number } {
  return normalizeRotation(rotation) % 180 === 0
    ? { w: box.width, h: box.height }
    : { w: box.height, h: box.width };
}

export function toPdf(dx: number, dy: number, box: Box, rotation: number): { x: number; y: number } {
  const { x: x0, y: y0, width: W, height: H } = box;
  switch (normalizeRotation(rotation)) {
    case 90:
      return { x: x0 + dy, y: y0 + dx };
    case 180:
      return { x: x0 + W - dx, y: y0 + dy };
    case 270:
      return { x: x0 + W - dy, y: y0 + H - dx };
    default:
      return { x: x0 + dx, y: y0 + H - dy };
  }
}

export function fromPdf(x: number, y: number, box: Box, rotation: number): { x: number; y: number } {
  const { x: x0, y: y0, width: W, height: H } = box;
  switch (normalizeRotation(rotation)) {
    case 90:
      return { x: y - y0, y: x - x0 };
    case 180:
      return { x: W - (x - x0), y: y - y0 };
    case 270:
      return { x: H - (y - y0), y: W - (x - x0) };
    default:
      return { x: x - x0, y: H - (y - y0) };
  }
}

/** Display rectangle → PDF rectangle (axis-aligned, any rotation). */
export function rectToPdf(
  r: { x: number; y: number; w: number; h: number },
  box: Box,
  rotation: number,
): Box {
  const a = toPdf(r.x, r.y, box, rotation);
  const b = toPdf(r.x + r.w, r.y + r.h, box, rotation);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/** PDF rectangle → display rectangle. */
export function rectFromPdf(r: Box, box: Box, rotation: number) {
  const a = fromPdf(r.x, r.y, box, rotation);
  const b = fromPdf(r.x + r.width, r.y + r.height, box, rotation);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const n = parseInt(full, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
