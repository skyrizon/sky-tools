import {
  DEFAULT_LINE_HEIGHT,
  textBaseline,
  textBlockHeight,
  type Annotation,
  type Rect,
  type TextAnnotation,
} from "@/lib/pdf-studio/types";
import { ITALIC_SKEW, STUDIO_FONTS, type StudioFontId } from "@/lib/pdf-studio/fonts";

/** CSS font stack for a studio font (defaults to IBM Plex Sans Thai for older objects). */
export function fontCss(font: StudioFontId | undefined): string {
  return `${STUDIO_FONTS[font ?? "plex"].css}, sans-serif`;
}

// Text is measured with a hidden element inside the studio, where the web
// font CSS variables are defined, so widths match what is drawn.
let probe: HTMLSpanElement | null = null;
const widthCache = new Map<string, number>();

if (typeof document !== "undefined" && "fonts" in document) {
  // Widths measured with a fallback font are wrong once the real font arrives.
  document.fonts.addEventListener?.("loadingdone", () => widthCache.clear());
}

export function measureLine(line: string, size: number, font: StudioFontId | undefined, bold: boolean): number {
  if (typeof document === "undefined") return line.length * size * 0.55;
  const key = `${font}|${bold}|${size}|${line}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  if (!probe || !probe.isConnected) {
    probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;white-space:pre;line-height:1";
    (document.querySelector("[data-studio-root]") ?? document.body).appendChild(probe);
  }
  probe.style.fontFamily = fontCss(font);
  probe.style.fontWeight = bold ? "700" : "400";
  probe.style.fontSize = `${size}px`;
  probe.textContent = line || " ";
  const width = probe.getBoundingClientRect().width;
  widthCache.set(key, width);
  return width;
}

/** Line positions of a text object: alignment within the widest line, baselines by line height. */
export function textLayout(ann: TextAnnotation) {
  const lineHeight = ann.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const texts = ann.text.split("\n");
  const widths = texts.map((line) => measureLine(line, ann.size, ann.font, ann.bold));
  const width = Math.max(...widths, ann.size * 0.5);
  const lines = texts.map((text, i) => {
    const offset = ann.align === "center" ? (width - widths[i]) / 2 : ann.align === "right" ? width - widths[i] : 0;
    return { text, x: ann.x + offset, baseline: ann.y + textBaseline(ann.size, i, lineHeight), width: widths[i] };
  });
  return { lines, width, height: textBlockHeight(ann.size, texts.length, lineHeight) };
}

/** Width of a text object's widest line, in points. */
export function measureText(ann: TextAnnotation): number {
  return textLayout(ann).width;
}

/** Axis-aligned bounds of an annotation, in page points. */
export function annotationBounds(ann: Annotation): Rect {
  switch (ann.type) {
    case "text": {
      const layout = textLayout(ann);
      return { x: ann.x, y: ann.y, w: layout.width, h: layout.height };
    }
    case "line":
      return {
        x: Math.min(ann.x1, ann.x2),
        y: Math.min(ann.y1, ann.y2),
        w: Math.abs(ann.x2 - ann.x1),
        h: Math.abs(ann.y2 - ann.y1),
      };
    case "ink": {
      const xs = ann.points.filter((_, i) => i % 2 === 0);
      const ys = ann.points.filter((_, i) => i % 2 === 1);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    default:
      return { x: ann.x, y: ann.y, w: ann.w, h: ann.h };
  }
}

/** Arrow-head segments, matching what the PDF export draws. */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, width: number): [number, number, number, number][] {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(8, width * 4);
  return [-1, 1].map((side) => {
    const a = angle + Math.PI - side * (Math.PI / 7);
    return [x2, y2, x2 + head * Math.cos(a), y2 + head * Math.sin(a)];
  });
}

/**
 * SVG for a page's annotations, in page-point coordinates. Every shape carries
 * data-ann-id so the editor can hit-test it; thumbnails render it read-only.
 */
export default function AnnotationShapes({
  annotations,
  hiddenId,
  interactive = false,
}: {
  annotations: Annotation[];
  /** Skipped while its text is being edited in a textarea overlay. */
  hiddenId?: string | null;
  interactive?: boolean;
}) {
  const hit = interactive ? { style: { cursor: "move" } } : { style: { pointerEvents: "none" as const } };

  return (
    <>
      {annotations.map((ann) => {
        if (ann.id === hiddenId) return null;
        switch (ann.type) {
          case "text": {
            const layout = textLayout(ann);
            return (
              <g key={ann.id} data-ann-id={ann.id} {...hit}>
                {interactive && <rect x={ann.x} y={ann.y} width={layout.width} height={layout.height} fill="transparent" />}
                {layout.lines.map((line, i) => (
                  <g
                    key={i}
                    transform={
                      ann.italic
                        ? `translate(${line.x} ${line.baseline}) skewX(${-ITALIC_SKEW}) translate(${-line.x} ${-line.baseline})`
                        : undefined
                    }
                  >
                    <text
                      x={line.x}
                      y={line.baseline}
                      fontSize={ann.size}
                      fontWeight={ann.bold ? 700 : 400}
                      fill={ann.color}
                      style={{ fontFamily: fontCss(ann.font), whiteSpace: "pre" }}
                    >
                      {line.text}
                    </text>
                    {ann.underline && line.text && (
                      <line
                        x1={line.x}
                        x2={line.x + line.width}
                        y1={line.baseline + ann.size * 0.12}
                        y2={line.baseline + ann.size * 0.12}
                        stroke={ann.color}
                        strokeWidth={Math.max(0.5, ann.size * 0.06)}
                      />
                    )}
                  </g>
                ))}
              </g>
            );
          }
          case "image":
            return (
              <image
                key={ann.id}
                data-ann-id={ann.id}
                href={ann.src}
                x={ann.x}
                y={ann.y}
                width={ann.w}
                height={ann.h}
                preserveAspectRatio="none"
                {...hit}
              />
            );
          case "rect":
            return (
              <rect
                key={ann.id}
                data-ann-id={ann.id}
                x={ann.x}
                y={ann.y}
                width={ann.w}
                height={ann.h}
                fill={ann.fill ?? "transparent"}
                stroke={ann.stroke ?? "none"}
                strokeWidth={ann.stroke ? ann.strokeWidth : 0}
                opacity={ann.opacity}
                {...hit}
              />
            );
          case "ellipse":
            return (
              <ellipse
                key={ann.id}
                data-ann-id={ann.id}
                cx={ann.x + ann.w / 2}
                cy={ann.y + ann.h / 2}
                rx={ann.w / 2}
                ry={ann.h / 2}
                fill={ann.fill ?? "transparent"}
                stroke={ann.stroke ?? "none"}
                strokeWidth={ann.stroke ? ann.strokeWidth : 0}
                opacity={ann.opacity}
                {...hit}
              />
            );
          case "line": {
            const segments = [[ann.x1, ann.y1, ann.x2, ann.y2], ...(ann.arrow ? arrowHead(ann.x1, ann.y1, ann.x2, ann.y2, ann.strokeWidth) : [])];
            return (
              <g key={ann.id} data-ann-id={ann.id} {...hit}>
                {interactive && (
                  <line x1={ann.x1} y1={ann.y1} x2={ann.x2} y2={ann.y2} stroke="transparent" strokeWidth={Math.max(12, ann.strokeWidth + 8)} />
                )}
                {segments.map(([x1, y1, x2, y2], i) => (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ann.stroke} strokeWidth={ann.strokeWidth} strokeLinecap="round" />
                ))}
              </g>
            );
          }
          case "ink": {
            const points = ann.points.reduce<string[]>((acc, v, i) => {
              if (i % 2 === 0) acc.push(`${v},${ann.points[i + 1]}`);
              return acc;
            }, []);
            return (
              <g key={ann.id} data-ann-id={ann.id} {...hit}>
                {interactive && (
                  <polyline points={points.join(" ")} fill="none" stroke="transparent" strokeWidth={Math.max(12, ann.strokeWidth + 8)} />
                )}
                <polyline
                  points={points.join(" ")}
                  fill="none"
                  stroke={ann.stroke}
                  strokeWidth={ann.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={ann.opacity}
                />
              </g>
            );
          }
        }
      })}
    </>
  );
}
