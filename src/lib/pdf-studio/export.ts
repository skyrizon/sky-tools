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
import { ITALIC_SKEW, fallbackFont, fontBytes, type StudioFontId } from "@/lib/pdf-studio/fonts";
import { lineMetrics, type RunStyle, type StyledRun } from "@/lib/pdf-studio/rich-text";
import {
  displaySize,
  hexToRgb,
  normalizeRotation,
  rectToPdf,
  toPdf,
  type Box,
} from "@/lib/pdf-studio/geometry";
import {
  type Annotation,
  type DocOptions,
  type FormValue,
  type StudioPage,
} from "@/lib/pdf-studio/types";

const color = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return rgb(r, g, b);
};

/** Formats a page-number label from a template containing {n} and {total}. */
export function pageNumberLabel(template: string, n: number, total: number): string {
  return template.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total));
}

type ResolvedFont = {
  font: PDFFont;
  /** No italic file: slant the glyphs instead. */
  synthItalic: boolean;
  /** No bold file: overprint slightly offset instead. */
  synthBold: boolean;
  /** Whether every visible character of the text has a glyph in this font. */
  covers(text: string): boolean;
  /** Whether the font has a glyph for this exact character (spaces included). */
  has(ch: string): boolean;
};

type Fonts = { get(font: StudioFontId | undefined, bold: boolean, italic?: boolean): Promise<ResolvedFont> };

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
      // Each run of one formatting (bold, italic, color…) resolves its own font. Characters
      // the font lacks (e.g. Thai in a Latin-only font, or letters missing from a PDF's
      // font subset) use the fallback font, the same way the browser shows them.
      type Segment = { text: string; font: ResolvedFont; style: RunStyle };
      const segmentsOf = async (runs: StyledRun[]) => {
        const segments: Segment[] = [];
        for (const { text, style } of runs) {
          const primary = await fonts.get(ann.font ?? "plex", style.bold, style.italic);
          const needsFallback = [...text].some((ch) => !primary.has(ch));
          const fallback = needsFallback ? await fonts.get(fallbackFont(ann.font), style.bold, style.italic) : primary;
          for (const ch of text) {
            const last = segments[segments.length - 1];
            // Fonts from a PDF are subsets that may even lack the space character.
            const font = primary.has(ch) || (/\s/.test(ch) && !fallback.has(ch)) ? primary : fallback;
            if (last?.font === font && last.style === style) last.text += ch;
            else segments.push({ text: ch, font, style });
          }
        }
        return segments;
      };
      const layout = lineMetrics(ann);
      const lines = await Promise.all(layout.lines.map(segmentsOf));
      const widthOf = (seg: Segment) => seg.font.font.widthOfTextAtSize(seg.text, seg.style.size);
      const widths = lines.map((line) => line.reduce((sum, seg) => sum + widthOf(seg), 0));
      const blockWidth = Math.max(...widths, 0);
      const r = (normalizeRotation(rotation) * Math.PI) / 180;
      lines.forEach((line, i) => {
        if (line.length === 0) return;
        const offset =
          ann.align === "center" ? (blockWidth - widths[i]) / 2 : ann.align === "right" ? blockWidth - widths[i] : 0;
        const x = ann.x + offset;
        const baseline = ann.y + layout.metrics[i].baseline;
        const origin = toPdf(x, baseline, box, rotation);
        // Rotate via the graphics state and draw in the text's own frame, so a
        // synthetic italic slant (ySkew) stays correct on rotated pages.
        page.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), origin.x, origin.y),
        );
        let segX = 0;
        const underlines: { from: number; to: number; color: string; size: number }[] = [];
        for (const seg of line) {
          const { font, synthBold, synthItalic } = seg.font;
          const size = seg.style.size;
          const passes = synthBold ? [0, size * 0.03] : [0];
          for (const dx of passes) {
            page.drawText(seg.text, {
              x: segX + dx,
              y: 0,
              size,
              font,
              color: color(seg.style.color),
              ySkew: synthItalic ? degrees(ITALIC_SKEW) : undefined,
            });
          }
          const width = widthOf(seg);
          if (seg.style.underline) underlines.push({ from: segX, to: segX + width, color: seg.style.color, size });
          segX += width;
        }
        page.pushOperators(popGraphicsState());
        for (const u of underlines) {
          const y = baseline + u.size * 0.12;
          page.drawLine({
            start: toPdf(x + u.from, y, box, rotation),
            end: toPdf(x + u.to, y, box, rotation),
            thickness: Math.max(0.5, u.size * 0.06),
            color: color(u.color),
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

  const embedded = new Map<string, Promise<ResolvedFont>>();
  const fonts: Fonts = {
    get(font, bold, italic = false) {
      const key = `${font ?? "plex"}|${bold}|${italic}`;
      if (!embedded.has(key)) {
        embedded.set(
          key,
          (async () => {
            const { bytes: original, synthItalic, synthBold } = await fontBytes(font, bold, italic);
            // fontkit reads past the end of the font when its last glyph is empty (e.g. Arimo)
            // and pdf-lib then fails to save; trailing padding keeps that read in bounds.
            const bytes = new Uint8Array(original.byteLength + 64);
            bytes.set(new Uint8Array(original));
            // Embedded whole: pdf-lib's subsetting drops glyphs for some fonts (e.g. Kanit),
            // and chosen/uploaded fonts can be anything. Fonts taken from a PDF are the
            // exception: they are already subsets whose unused glyphs can't be read whole.
            const pdfFont = await out.embedFont(bytes, { subset: !!font?.startsWith("pdf:") });
            const parsed = fontkit.create(bytes);
            return {
              font: pdfFont,
              synthItalic,
              synthBold,
              covers: (text: string) =>
                [...text].every((ch) => /\s/.test(ch) || parsed.hasGlyphForCodePoint(ch.codePointAt(0)!)),
              has: (ch: string) => parsed.hasGlyphForCodePoint(ch.codePointAt(0)!),
            };
          })(),
        );
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
      const font = await doc.embedFont((await fontBytes("plex", false, false)).bytes, { subset: true });
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
    const bold = (await fonts.get("plex", true)).font;
    const regular = (await fonts.get("plex", false)).font;
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
