import {
  LineCapStyle,
  PDFDocument,
  concatTransformationMatrix,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { applyFormValues } from "@/lib/pdf-studio/forms";
import { applyMetadata } from "@/lib/pdf-studio/metadata";
import { ITALIC_SKEW, STUDIO_FONTS, type StudioFontId } from "@/lib/pdf-studio/fonts";
import {
  displaySize,
  hexToRgb,
  normalizeRotation,
  rectToPdf,
  toPdf,
  type Box,
} from "@/lib/pdf-studio/geometry";
import {
  DEFAULT_LINE_HEIGHT,
  textBaseline,
  type Annotation,
  type DocOptions,
  type FormValue,
  type StudioPage,
} from "@/lib/pdf-studio/types";

// Every studio font covers Thai and Latin, so a mixed-language line needs only one font.
const fontCache = new Map<string, Promise<ArrayBuffer>>();

function fontBytes(font: StudioFontId, weight: "regular" | "bold"): Promise<ArrayBuffer> {
  const url = STUDIO_FONTS[font].files[weight];
  if (!fontCache.has(url)) {
    fontCache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Font ${url} failed to load`);
        return r.arrayBuffer();
      }),
    );
  }
  return fontCache.get(url)!;
}

const color = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return rgb(r, g, b);
};

/** Formats a page-number label from a template containing {n} and {total}. */
export function pageNumberLabel(template: string, n: number, total: number): string {
  return template.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total));
}

type Fonts = { get(bold: boolean, font?: StudioFontId): Promise<PDFFont> };

async function drawAnnotation(
  page: PDFPage,
  ann: Annotation,
  box: Box,
  rotation: number,
  fonts: Fonts,
  image: (src: string) => Promise<PDFImage>,
) {
  const rotate = degrees(normalizeRotation(rotation));
  const quarter = normalizeRotation(rotation) % 180 === 90;

  switch (ann.type) {
    case "text": {
      const font = await fonts.get(ann.bold, ann.font ?? "plex");
      const lines = ann.text.split("\n");
      const widths = lines.map((line) => font.widthOfTextAtSize(line, ann.size));
      const blockWidth = Math.max(...widths, 0);
      lines.forEach((line, i) => {
        if (!line) return;
        const offset =
          ann.align === "center" ? (blockWidth - widths[i]) / 2 : ann.align === "right" ? blockWidth - widths[i] : 0;
        const x = ann.x + offset;
        const baseline = ann.y + textBaseline(ann.size, i, ann.lineHeight ?? DEFAULT_LINE_HEIGHT);
        const origin = toPdf(x, baseline, box, rotation);
        if (ann.italic) {
          // Rotate via the graphics state, then slant the glyphs in the text's own
          // frame (ySkew), so italics stay correct on rotated pages too.
          const r = (normalizeRotation(rotation) * Math.PI) / 180;
          page.pushOperators(
            pushGraphicsState(),
            concatTransformationMatrix(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), origin.x, origin.y),
          );
          page.drawText(line, { x: 0, y: 0, size: ann.size, font, color: color(ann.color), ySkew: degrees(ITALIC_SKEW) });
          page.pushOperators(popGraphicsState());
        } else {
          page.drawText(line, { ...origin, size: ann.size, font, color: color(ann.color), rotate });
        }
        if (ann.underline) {
          const y = baseline + ann.size * 0.12;
          page.drawLine({
            start: toPdf(x, y, box, rotation),
            end: toPdf(x + widths[i], y, box, rotation),
            thickness: Math.max(0.5, ann.size * 0.06),
            color: color(ann.color),
          });
        }
      });
      break;
    }
    case "image": {
      const origin = toPdf(ann.x, ann.y + ann.h, box, rotation);
      page.drawImage(await image(ann.src), { ...origin, width: ann.w, height: ann.h, rotate });
      break;
    }
    case "rect": {
      const origin = toPdf(ann.x, ann.y + ann.h, box, rotation);
      page.drawRectangle({
        ...origin,
        width: ann.w,
        height: ann.h,
        rotate,
        color: ann.fill ? color(ann.fill) : undefined,
        opacity: ann.opacity,
        borderColor: ann.stroke ? color(ann.stroke) : undefined,
        borderWidth: ann.stroke ? ann.strokeWidth : 0,
        borderOpacity: ann.opacity,
      });
      break;
    }
    case "ellipse": {
      const center = toPdf(ann.x + ann.w / 2, ann.y + ann.h / 2, box, rotation);
      page.drawEllipse({
        ...center,
        xScale: (quarter ? ann.h : ann.w) / 2,
        yScale: (quarter ? ann.w : ann.h) / 2,
        color: ann.fill ? color(ann.fill) : undefined,
        opacity: ann.opacity,
        borderColor: ann.stroke ? color(ann.stroke) : undefined,
        borderWidth: ann.stroke ? ann.strokeWidth : 0,
        borderOpacity: ann.opacity,
      });
      break;
    }
    case "line": {
      const segments: [number, number, number, number][] = [[ann.x1, ann.y1, ann.x2, ann.y2]];
      if (ann.arrow) {
        const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
        const head = Math.max(8, ann.strokeWidth * 4);
        for (const side of [-1, 1]) {
          const a = angle + Math.PI - side * (Math.PI / 7);
          segments.push([ann.x2, ann.y2, ann.x2 + head * Math.cos(a), ann.y2 + head * Math.sin(a)]);
        }
      }
      for (const [x1, y1, x2, y2] of segments) {
        page.drawLine({
          start: toPdf(x1, y1, box, rotation),
          end: toPdf(x2, y2, box, rotation),
          thickness: ann.strokeWidth,
          color: color(ann.stroke),
          lineCap: LineCapStyle.Round,
        });
      }
      break;
    }
    case "ink": {
      if (ann.points.length < 4) break;
      let path = "";
      for (let i = 0; i < ann.points.length; i += 2) {
        const p = toPdf(ann.points[i], ann.points[i + 1], box, rotation);
        // drawSvgPath flips y around its origin, so negate to stay in user space.
        path += `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${(-p.y).toFixed(2)} `;
      }
      page.drawSvgPath(path, {
        x: 0,
        y: 0,
        borderColor: color(ann.stroke),
        borderWidth: ann.strokeWidth,
        borderOpacity: ann.opacity,
        borderLineCap: LineCapStyle.Round,
      });
      break;
    }
  }
}

/**
 * Builds the edited PDF: pages in studio order with their rotation, crop, and
 * annotations; filled forms flattened; plus watermark and page numbers.
 */
export async function exportStudioPdf({
  pages,
  options,
  formValues,
}: {
  pages: StudioPage[];
  options: DocOptions;
  /** Form values per source file; those files' forms are filled and flattened. */
  formValues: Map<File, Record<string, FormValue>>;
}): Promise<Blob> {
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);

  const embedded = new Map<string, Promise<PDFFont>>();
  const fonts: Fonts = {
    get(bold, font = "plex") {
      const weight = bold ? "bold" : "regular";
      const key = `${font}|${weight}`;
      if (!embedded.has(key)) {
        embedded.set(key, fontBytes(font, weight).then((bytes) => out.embedFont(bytes, { subset: true })));
      }
      return embedded.get(key)!;
    },
  };

  const images = new Map<string, Promise<PDFImage>>();
  const image = (src: string) => {
    if (!images.has(src)) {
      const bytes = fetch(src).then((r) => r.arrayBuffer());
      images.set(src, bytes.then((b) => (src.startsWith("data:image/png") ? out.embedPng(b) : out.embedJpg(b))));
    }
    return images.get(src)!;
  };

  // Load each source once; fill and flatten its form if it has values.
  const sources = new Map<File, PDFDocument>();
  for (const page of pages) {
    if (sources.has(page.file)) continue;
    const doc = await PDFDocument.load(await page.file.arrayBuffer());
    const values = formValues.get(page.file);
    if (values && Object.keys(values).length > 0) {
      doc.registerFontkit(fontkit);
      const font = await doc.embedFont(await fontBytes("plex", "regular"), { subset: true });
      applyFormValues(doc, values);
      const form = doc.getForm();
      form.updateFieldAppearances(font);
      form.flatten();
    }
    sources.set(page.file, doc);
  }

  for (const studioPage of pages) {
    const [page] = await out.copyPages(sources.get(studioPage.file)!, [studioPage.index]);
    out.addPage(page);
    const ownRotation = page.getRotation().angle;
    const box = page.getCropBox();

    for (const ann of studioPage.annotations) {
      await drawAnnotation(page, ann, box, ownRotation, fonts, image);
    }
    if (studioPage.crop) {
      const c = rectToPdf(studioPage.crop, box, ownRotation);
      page.setCropBox(c.x, c.y, c.width, c.height);
    }
    page.setRotation(degrees(normalizeRotation(ownRotation + studioPage.rotation)));
  }

  // Watermark and page numbers follow each page's final orientation and crop.
  const { watermark, pageNumbers } = options;
  const total = out.getPageCount();
  if ((watermark.enabled && watermark.text.trim()) || pageNumbers.enabled) {
    const bold = await fonts.get(true);
    const regular = await fonts.get(false);
    out.getPages().forEach((page, i) => {
      const rotation = page.getRotation().angle;
      const box = page.getCropBox();
      const { w, h } = displaySize(box, rotation);

      if (watermark.enabled && watermark.text.trim()) {
        const size = watermark.size;
        const width = bold.widthOfTextAtSize(watermark.text, size);
        const theta = Math.atan2(h, w); // along the page diagonal
        // Baseline-left of text centred on the page, rotated by theta (y-up math, display y-down).
        const vx = -width / 2;
        const vy = -size * 0.35;
        const ox = w / 2 + (vx * Math.cos(theta) - vy * Math.sin(theta));
        const oy = h / 2 - (vx * Math.sin(theta) + vy * Math.cos(theta));
        page.drawText(watermark.text, {
          ...toPdf(ox, oy, box, rotation),
          size,
          font: bold,
          color: color(watermark.color),
          opacity: watermark.opacity,
          rotate: degrees((theta * 180) / Math.PI + normalizeRotation(rotation)),
        });
      }

      if (pageNumbers.enabled) {
        const label = pageNumberLabel(pageNumbers.template, pageNumbers.start + i, pageNumbers.start + total - 1);
        const size = pageNumbers.size;
        const width = regular.widthOfTextAtSize(label, size);
        const margin = Math.max(18, size * 1.6);
        const [vertical, horizontal] = pageNumbers.position.split("-");
        const x = horizontal === "left" ? margin : horizontal === "right" ? w - margin - width : (w - width) / 2;
        const y = vertical === "top" ? margin + size * 0.75 : h - margin;
        page.drawText(label, {
          ...toPdf(x, y, box, rotation),
          size,
          font: regular,
          color: rgb(0.2, 0.22, 0.25),
          rotate: degrees(normalizeRotation(rotation)),
        });
      }
    });
  }

  applyMetadata(out, options.metadata, options.created);
  return new Blob([(await out.save()) as BlobPart], { type: "application/pdf" });
}
