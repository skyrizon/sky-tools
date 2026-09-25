import { textBaseline, textLineHeight, type Annotation, type Rect } from "@/lib/pdf-studio/types";

export const STUDIO_FONT = "var(--font-thai), 'IBM Plex Sans Thai', sans-serif";

let measureCtx: CanvasRenderingContext2D | null = null;

/** Width of a text annotation's widest line, in points. */
export function measureText(text: string, size: number, bold: boolean): number {
  if (typeof document === "undefined") return text.length * size * 0.55;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * size * 0.55;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-thai") || "sans-serif";
  measureCtx.font = `${bold ? 700 : 400} ${size}px ${family}`;
  return Math.max(...text.split("\n").map((line) => measureCtx!.measureText(line).width), size * 0.5);
}

/** Axis-aligned bounds of an annotation, in page points. */
export function annotationBounds(ann: Annotation): Rect {
  switch (ann.type) {
    case "text": {
      const lines = ann.text.split("\n").length;
      return { x: ann.x, y: ann.y, w: measureText(ann.text, ann.size, ann.bold), h: lines * textLineHeight(ann.size) };
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
            const bounds = annotationBounds(ann);
            return (
              <g key={ann.id} data-ann-id={ann.id} {...hit}>
                {interactive && <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="transparent" />}
                {ann.text.split("\n").map((line, i) => (
                  <text
                    key={i}
                    x={ann.x}
                    y={ann.y + textBaseline(ann.size, i)}
                    fontSize={ann.size}
                    fontWeight={ann.bold ? 700 : 400}
                    fill={ann.color}
                    style={{ fontFamily: STUDIO_FONT, whiteSpace: "pre" }}
                  >
                    {line}
                  </text>
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
