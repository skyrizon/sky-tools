import QRCode, { type QRCodeErrorCorrectionLevel } from "qrcode";

export type DotStyle = "square" | "dots";

export type QrRenderOptions = {
  /** Total rendered size in px, including the quiet zone. */
  size: number;
  errorCorrectionLevel: QRCodeErrorCorrectionLevel;
  moduleColor: string;
  backgroundColor: string;
  eyeColor: string;
  dotStyle: DotStyle;
  /** Quiet zone width in modules. */
  margin?: number;
};

type EyeBox = { row: number; col: number };

function getEyeBoxes(moduleCount: number): EyeBox[] {
  return [
    { row: 0, col: 0 },
    { row: 0, col: moduleCount - 7 },
    { row: moduleCount - 7, col: 0 },
  ];
}

function isInEye(row: number, col: number, eyes: EyeBox[]): boolean {
  return eyes.some(
    (eye) => row >= eye.row && row < eye.row + 7 && col >= eye.col && col < eye.col + 7,
  );
}

function buildQrMatrix(data: string, errorCorrectionLevel: QRCodeErrorCorrectionLevel) {
  const qr = QRCode.create(data, { errorCorrectionLevel });
  return { moduleCount: qr.modules.size, bits: qr.modules.data };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Draws a styled QR code (square or dot modules, separately colored eyes) onto a canvas. */
export function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  data: string,
  opts: QrRenderOptions,
): void {
  const margin = opts.margin ?? 2;
  const { moduleCount, bits } = buildQrMatrix(data, opts.errorCorrectionLevel);
  const totalModules = moduleCount + margin * 2;
  const ms = opts.size / totalModules;
  const offset = margin * ms;
  const eyes = getEyeBoxes(moduleCount);

  canvas.width = opts.size;
  canvas.height = opts.size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, opts.size, opts.size);

  ctx.fillStyle = opts.moduleColor;
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (isInEye(row, col, eyes)) continue;
      if (!bits[row * moduleCount + col]) continue;

      const x = offset + col * ms;
      const y = offset + row * ms;

      if (opts.dotStyle === "dots") {
        const r = (ms * 0.82) / 2;
        ctx.beginPath();
        ctx.arc(x + ms / 2, y + ms / 2, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, ms, ms);
      }
    }
  }

  const cornerRadius = opts.dotStyle === "dots" ? ms * 1.8 : ms * 0.6;
  for (const eye of eyes) {
    const bx = offset + eye.col * ms;
    const by = offset + eye.row * ms;

    ctx.fillStyle = opts.eyeColor;
    roundRectPath(ctx, bx, by, ms * 7, ms * 7, cornerRadius);
    ctx.fill();

    ctx.fillStyle = opts.backgroundColor;
    roundRectPath(ctx, bx + ms, by + ms, ms * 5, ms * 5, cornerRadius * 0.7);
    ctx.fill();

    ctx.fillStyle = opts.eyeColor;
    roundRectPath(ctx, bx + ms * 2, by + ms * 2, ms * 3, ms * 3, cornerRadius * 0.45);
    ctx.fill();
  }
}

function svgRoundRect(x: number, y: number, w: number, h: number, r: number, fill: string): string {
  const radius = Math.min(r, w / 2, h / 2);
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${radius.toFixed(2)}" ry="${radius.toFixed(2)}" fill="${fill}"/>`;
}

/** Builds a self-contained SVG string mirroring renderQrToCanvas's styling. */
export function renderQrToSvgString(
  data: string,
  opts: QrRenderOptions,
  logoDataUrl?: string | null,
): string {
  const margin = opts.margin ?? 2;
  const { moduleCount, bits } = buildQrMatrix(data, opts.errorCorrectionLevel);
  const totalModules = moduleCount + margin * 2;
  const ms = opts.size / totalModules;
  const offset = margin * ms;
  const eyes = getEyeBoxes(moduleCount);

  const parts: string[] = [
    `<rect x="0" y="0" width="${opts.size}" height="${opts.size}" fill="${opts.backgroundColor}"/>`,
  ];

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (isInEye(row, col, eyes)) continue;
      if (!bits[row * moduleCount + col]) continue;

      const x = offset + col * ms;
      const y = offset + row * ms;

      if (opts.dotStyle === "dots") {
        const r = (ms * 0.82) / 2;
        parts.push(
          `<circle cx="${(x + ms / 2).toFixed(2)}" cy="${(y + ms / 2).toFixed(2)}" r="${r.toFixed(2)}" fill="${opts.moduleColor}"/>`,
        );
      } else {
        parts.push(
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${ms.toFixed(2)}" height="${ms.toFixed(2)}" fill="${opts.moduleColor}"/>`,
        );
      }
    }
  }

  const cornerRadius = opts.dotStyle === "dots" ? ms * 1.8 : ms * 0.6;
  for (const eye of eyes) {
    const bx = offset + eye.col * ms;
    const by = offset + eye.row * ms;
    parts.push(svgRoundRect(bx, by, ms * 7, ms * 7, cornerRadius, opts.eyeColor));
    parts.push(svgRoundRect(bx + ms, by + ms, ms * 5, ms * 5, cornerRadius * 0.7, opts.backgroundColor));
    parts.push(svgRoundRect(bx + ms * 2, by + ms * 2, ms * 3, ms * 3, cornerRadius * 0.45, opts.eyeColor));
  }

  if (logoDataUrl) {
    const logoSize = opts.size * 0.28;
    const lx = (opts.size - logoSize) / 2;
    const ly = (opts.size - logoSize) / 2;
    const pad = logoSize * 0.12;
    parts.push(
      `<rect x="${(lx - pad).toFixed(2)}" y="${(ly - pad).toFixed(2)}" width="${(logoSize + pad * 2).toFixed(2)}" height="${(logoSize + pad * 2).toFixed(2)}" fill="${opts.backgroundColor}"/>`,
    );
    parts.push(
      `<image href="${logoDataUrl}" x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" width="${logoSize.toFixed(2)}" height="${logoSize.toFixed(2)}" preserveAspectRatio="xMidYMid slice"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.size} ${opts.size}" width="${opts.size}" height="${opts.size}">${parts.join("")}</svg>`;
}
