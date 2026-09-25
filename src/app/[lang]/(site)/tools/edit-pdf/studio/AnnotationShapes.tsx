import type { Annotation, Rect, TextAnnotation } from "@/lib/pdf-studio/types";
import { ITALIC_SKEW, fontCss, hasRealItalic, type StudioFontId } from "@/lib/pdf-studio/fonts";
import { lineMetrics } from "@/lib/pdf-studio/rich-text";

export { fontCss };

// Text is measured with a hidden element inside the studio, where the web
// font CSS variables are defined, so widths match what is drawn.
let probe: HTMLSpanElement | null = null;
const widthCache = new Map<string, number>();

if (typeof document !== "undefined" && "fonts" in document) {
  // Widths measured with a fallback font are wrong once the real font arrives.
  document.fonts.addEventListener?.("loadingdone", () => widthCache.clear());
}

export function measureLine(
  line: string,
  size: number,
  font: StudioFontId | undefined,
  bold: boolean,
  italic = false,
): number {
  if (typeof document === "undefined") return line.length * size * 0.55;
  const key = `${font}|${bold}|${italic}|${size}|${line}`;
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
  // Real italic faces can have different widths; synthetic slants don't change width.
  probe.style.fontStyle = italic && hasRealItalic(font, bold) ? "italic" : "normal";
  probe.style.fontSize = `${size}px`;
  probe.textContent = line || " ";
  const width = probe.getBoundingClientRect().width;
  widthCache.set(key, width);
  return width;
}

/**
 * Line positions of a text object: alignment within the widest line, baselines
 * by line height (each line as tall as its largest text), and each differently
 * formatted run placed along its line.
 */
export function textLayout(ann: TextAnnotation) {
  const { lines: styled, metrics, height } = lineMetrics(ann);
  const measured = styled.map((runs) => {
    let x = 0;
    const placed = runs.map((run) => {
      const width = measureLine(run.text, run.style.size, ann.font, run.style.bold, run.style.italic);
      const at = { ...run, dx: x, width };
      x += width;
      return at;
    });
    return { runs: placed, width: x };
  });
  const width = Math.max(...measured.map((line) => line.width), ann.size * 0.5);
  const lines = measured.map((line, i) => {
    const offset = ann.align === "center" ? (width - line.width) / 2 : ann.align === "right" ? width - line.width : 0;
    const x = ann.x + offset;
    return {
      x,
      baseline: ann.y + metrics[i].baseline,
      width: line.width,
      runs: line.runs.map((run) => ({ ...run, x: x + run.dx })),
    };
  });
  return { lines, width, height };
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
                {layout.lines.flatMap((line, i) =>
                  line.runs.map(({ text, x, width, style }, j) => {
                    const realItalic = style.italic && hasRealItalic(ann.font, style.bold);
                    return (
                      <g
                        key={`${i}:${j}`}
                        transform={
                          style.italic && !realItalic
                            ? `translate(${x} ${line.baseline}) skewX(${-ITALIC_SKEW}) translate(${-x} ${-line.baseline})`
                            : undefined
                        }
                      >
                        <text
                          x={x}
                          y={line.baseline}
                          fontSize={style.size}
                          fontWeight={style.bold ? 700 : 400}
                          fontStyle={realItalic ? "italic" : undefined}
                          fill={style.color}
                          style={{ fontFamily: fontCss(ann.font), whiteSpace: "pre" }}
                        >
                          {text}
                        </text>
                        {style.underline && (
                          <line
                            x1={x}
                            x2={x + width}
                            y1={line.baseline + style.size * 0.12}
                            y2={line.baseline + style.size * 0.12}
                            stroke={style.color}
                            strokeWidth={Math.max(0.5, style.size * 0.06)}
                          />
                        )}
                      </g>
                    );
                  }),
                )}
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
