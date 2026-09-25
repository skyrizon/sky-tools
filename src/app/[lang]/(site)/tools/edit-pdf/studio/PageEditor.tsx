"use client";

import { useRef } from "react";
import { pageNumberLabel } from "@/lib/pdf-studio/export";
import type { TextRun } from "@/lib/pdf-convert";
import {
  DEFAULT_LINE_HEIGHT,
  textLineHeight,
  type Annotation,
  type DocOptions,
  type FormValue,
  type FormWidget,
  type Rect,
  type StudioPage,
  type Tool,
} from "@/lib/pdf-studio/types";
import AnnotationShapes, { annotationBounds, fontCss, measureText } from "./AnnotationShapes";
import type { StudioFontId } from "@/lib/pdf-studio/fonts";

export type StyleState = {
  color: string;
  fill: string | null;
  strokeWidth: number;
  fontSize: number;
  bold: boolean;
  font: StudioFontId;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
  lineHeight: number;
};

export type PendingImage = { src: string; w: number; h: number; kind: "image" | "signature" };

type Drag =
  | { mode: "move"; start: Pt; original: Annotation }
  | { mode: "resize"; start: Pt; original: Annotation; handle: string }
  | { mode: "create"; start: Pt; id: string }
  | { mode: "crop"; start: Pt };

type Pt = { x: number; y: number };

const newId = () => Math.random().toString(36).slice(2, 10);
const HIGHLIGHT = "#facc15";

/** Moves an annotation by (dx, dy) points. */
function translate(ann: Annotation, dx: number, dy: number): Annotation {
  switch (ann.type) {
    case "line":
      return { ...ann, x1: ann.x1 + dx, y1: ann.y1 + dy, x2: ann.x2 + dx, y2: ann.y2 + dy };
    case "ink":
      return { ...ann, points: ann.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
    default:
      return { ...ann, x: ann.x + dx, y: ann.y + dy };
  }
}

function normalizeRect(a: Pt, b: Pt): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export default function PageEditor({
  page,
  imageUrl,
  tool,
  style,
  scale,
  onActivate,
  selectedId,
  onSelect,
  editingId,
  onEditingChange,
  beginChange,
  updatePage,
  pendingImage,
  onPlaced,
  formWidgets,
  formValues,
  onFormChange,
  docOptions,
  pageNumber,
  pageTotal,
  newTextLabel,
  textRuns,
  onEditRun,
}: {
  page: StudioPage;
  imageUrl?: string;
  tool: Tool;
  style: StyleState;
  /** Pixels per point. */
  scale: number;
  /** Called when the user starts interacting with this page (it becomes the current page). */
  onActivate: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  /** Records an undo step before a change starts. */
  beginChange: () => void;
  /** Applies a change without recording an undo step. */
  updatePage: (fn: (page: StudioPage) => StudioPage) => void;
  pendingImage: PendingImage | null;
  /** Called after text, an image, or a signature has been placed. */
  onPlaced: () => void;
  formWidgets: FormWidget[];
  formValues: Record<string, FormValue>;
  onFormChange: (fieldName: string, value: FormValue) => void;
  docOptions: DocOptions;
  pageNumber: number;
  pageTotal: number;
  newTextLabel: string;
  /** Lines of original text, shown as click targets by the Edit text tool. */
  textRuns?: TextRun[];
  onEditRun?: (run: TextRun) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const rotation = ((page.rotation % 360) + 360) % 360;
  const quarter = rotation % 180 === 90;
  const { w: pw, h: ph } = page.size;
  const finalW = quarter ? ph : pw;
  const finalH = quarter ? pw : ph;
  const w = pw * scale;
  const h = ph * scale;
  const frameW = finalW * scale;
  const frameH = finalH * scale;

  /** Pointer position → page points, undoing the page rotation. */
  function toPage(event: { clientX: number; clientY: number }): Pt {
    const r = frameRef.current!.getBoundingClientRect();
    const dx = event.clientX - (r.left + r.width / 2);
    const dy = event.clientY - (r.top + r.height / 2);
    const a = (-rotation * Math.PI) / 180;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    return { x: (lx + w / 2) / scale, y: (ly + h / 2) / scale };
  }

  const setAnn = (id: string, fn: (a: Annotation) => Annotation) =>
    updatePage((p) => ({ ...p, annotations: p.annotations.map((a) => (a.id === id ? fn(a) : a)) }));

  function add(ann: Annotation) {
    beginChange();
    updatePage((p) => ({ ...p, annotations: [...p.annotations, ann] }));
    onSelect(ann.id);
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const pt = toPage(event);
    const target = event.target as Element;
    const handle = target.closest("[data-handle]")?.getAttribute("data-handle");
    const annId = target.closest("[data-ann-id]")?.getAttribute("data-ann-id");
    const existing = annId ? page.annotations.find((a) => a.id === annId) : undefined;

    if (tool === "editText" && !existing) {
      const runId = target.closest("[data-run-id]")?.getAttribute("data-run-id");
      const run = textRuns?.find((r) => r.id === runId);
      if (run) onEditRun?.(run);
      else onSelect(null);
      return;
    }

    if (tool === "select" || ((tool === "text" || tool === "editText") && existing?.type === "text")) {
      if (handle && selectedId) {
        const original = page.annotations.find((a) => a.id === selectedId)!;
        beginChange();
        drag.current = { mode: "resize", start: pt, original, handle };
      } else if (existing) {
        onSelect(existing.id);
        if (tool === "text" || tool === "editText") {
          beginChange();
          onEditingChange(existing.id);
          return;
        }
        beginChange();
        drag.current = { mode: "move", start: pt, original: existing };
      } else {
        onSelect(null);
        return;
      }
    } else if (tool === "text") {
      const id = newId();
      add({
        type: "text",
        id,
        x: pt.x,
        y: pt.y - style.fontSize * 0.65,
        text: newTextLabel,
        size: style.fontSize,
        color: style.color,
        bold: style.bold,
        font: style.font,
        italic: style.italic,
        underline: style.underline,
        align: style.align,
        lineHeight: style.lineHeight,
      });
      onEditingChange(id);
      onPlaced();
      return;
    } else if (tool === "image" || tool === "signature") {
      if (!pendingImage) return;
      add({
        type: "image",
        id: newId(),
        x: pt.x - pendingImage.w / 2,
        y: pt.y - pendingImage.h / 2,
        w: pendingImage.w,
        h: pendingImage.h,
        src: pendingImage.src,
        kind: pendingImage.kind,
      });
      onPlaced();
      return;
    } else if (tool === "crop") {
      beginChange();
      drag.current = { mode: "crop", start: pt };
      updatePage((p) => ({ ...p, crop: { x: pt.x, y: pt.y, w: 0, h: 0 } }));
    } else {
      const id = newId();
      const base = { id, x: pt.x, y: pt.y, w: 0, h: 0 };
      let ann: Annotation;
      if (tool === "pen" || tool === "highlighter") {
        ann = {
          type: "ink",
          id,
          points: [pt.x, pt.y],
          stroke: tool === "highlighter" ? HIGHLIGHT : style.color,
          strokeWidth: tool === "highlighter" ? Math.max(10, style.strokeWidth * 4) : style.strokeWidth,
          opacity: tool === "highlighter" ? 0.4 : 1,
        };
      } else if (tool === "line" || tool === "arrow") {
        ann = { type: "line", id, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, stroke: style.color, strokeWidth: style.strokeWidth, arrow: tool === "arrow" };
      } else if (tool === "whiteout") {
        ann = { type: "rect", ...base, stroke: null, fill: "#ffffff", strokeWidth: 0, opacity: 1, role: "whiteout" };
      } else if (tool === "highlight") {
        ann = { type: "rect", ...base, stroke: null, fill: HIGHLIGHT, strokeWidth: 0, opacity: 0.4, role: "highlight" };
      } else {
        ann = { type: tool === "ellipse" ? "ellipse" : "rect", ...base, stroke: style.color, fill: style.fill, strokeWidth: style.strokeWidth, opacity: 1 };
      }
      add(ann);
      drag.current = { mode: "create", start: pt, id };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const pt = toPage(event);

    if (d.mode === "move") {
      const moved = translate(d.original, pt.x - d.start.x, pt.y - d.start.y);
      setAnn(d.original.id, () => moved);
    } else if (d.mode === "crop") {
      updatePage((p) => ({ ...p, crop: normalizeRect(d.start, pt) }));
    } else if (d.mode === "create") {
      setAnn(d.id, (a) => {
        if (a.type === "ink") {
          const lx = a.points[a.points.length - 2];
          const ly = a.points[a.points.length - 1];
          return Math.hypot(pt.x - lx, pt.y - ly) * scale < 2 ? a : { ...a, points: [...a.points, pt.x, pt.y] };
        }
        if (a.type === "line") return { ...a, x2: pt.x, y2: pt.y };
        if (a.type === "rect" || a.type === "ellipse") return { ...a, ...normalizeRect(d.start, pt) };
        return a;
      });
    } else if (d.mode === "resize") {
      const o = d.original;
      if (o.type === "line") {
        setAnn(o.id, () => (d.handle === "p1" ? { ...o, x1: pt.x, y1: pt.y } : { ...o, x2: pt.x, y2: pt.y }));
        return;
      }
      const b = annotationBounds(o);
      // The corner opposite the dragged handle stays put.
      const fixed = {
        x: d.handle.includes("w") ? b.x + b.w : b.x,
        y: d.handle.includes("n") ? b.y + b.h : b.y,
      };
      let r = normalizeRect(fixed, pt);
      if (o.type === "image" || o.type === "text") {
        // Keep the aspect ratio for images and scale text by height.
        const ratio = b.w / Math.max(b.h, 0.01);
        const hFromW = r.w / ratio;
        r = { ...r, h: Math.max(hFromW, 4) };
        if (d.handle.includes("n")) r.y = fixed.y - r.h;
        if (d.handle.includes("w")) r.x = fixed.x - r.w;
      }
      if (o.type === "text") {
        const size = Math.max(4, Math.round(o.size * (r.h / Math.max(b.h, 0.01)) * 10) / 10);
        setAnn(o.id, () => ({ ...o, size, x: r.x, y: r.y }));
      } else if (o.type === "image" || o.type === "rect" || o.type === "ellipse") {
        setAnn(o.id, () => ({ ...o, x: r.x, y: r.y, w: Math.max(r.w, 2), h: Math.max(r.h, 2) }));
      }
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === "create") {
      // A plain click with a shape tool drops a default-sized shape instead of an invisible one.
      setAnn(d.id, (a) => {
        if ((a.type === "rect" || a.type === "ellipse") && a.w < 3 && a.h < 3) {
          return { ...a, x: a.x - 50, y: a.y - 25, w: 100, h: 50 };
        }
        if (a.type === "line" && Math.hypot(a.x2 - a.x1, a.y2 - a.y1) < 3) return { ...a, x2: a.x1 + 100 };
        return a;
      });
    } else if (d.mode === "crop") {
      updatePage((p) => (p.crop && (p.crop.w < 10 || p.crop.h < 10) ? { ...p, crop: null } : p));
    }
  }

  const selected = page.annotations.find((a) => a.id === selectedId);
  const editing = page.annotations.find((a) => a.id === editingId && a.type === "text");
  const selectedBounds = selected ? annotationBounds(selected) : null;
  const pad = 4 / scale;
  const handleSize = 8 / scale;
  const cursor =
    tool === "select" ? "default" : tool === "text" || tool === "editText" ? "text" : (tool === "image" || tool === "signature") && !pendingImage ? "not-allowed" : "crosshair";

  const { watermark, pageNumbers } = docOptions;
  const theta = (Math.atan2(finalH, finalW) * 180) / Math.PI;
  const label = pageNumberLabel(pageNumbers.template, pageNumbers.start + pageNumber - 1, pageNumbers.start + pageTotal - 1);
  const [vertical, horizontal] = pageNumbers.position.split("-");
  const margin = Math.max(18, pageNumbers.size * 1.6);

  return (
        <div
          ref={frameRef}
          className="relative shrink-0"
          style={{ width: frameW, height: frameH }}
          onPointerDownCapture={onActivate}
          onFocusCapture={onActivate}
        >
          <div
            className="absolute bg-white shadow-xl shadow-black/10"
            style={{
              width: w,
              height: h,
              left: (frameW - w) / 2,
              top: (frameH - h) / 2,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
            ) : (
              <div className="absolute inset-0 animate-pulse bg-border-soft" />
            )}

            <svg
              viewBox={`0 0 ${pw} ${ph}`}
              width={w}
              height={h}
              className="absolute inset-0"
              style={{ cursor, touchAction: tool === "select" ? "auto" : "none" }}
              onPointerDown={onPointerDown}
              // Keep focus where it is: the browser would otherwise blur a just-opened text box.
              onMouseDown={(e) => e.preventDefault()}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={(e) => {
                const id = (e.target as Element).closest("[data-ann-id]")?.getAttribute("data-ann-id");
                const ann = id ? page.annotations.find((a) => a.id === id) : undefined;
                if (ann?.type === "text") {
                  beginChange();
                  onSelect(ann.id);
                  onEditingChange(ann.id);
                }
              }}
            >
              {tool === "editText" &&
                textRuns
                  ?.filter((run) => !page.annotations.some((a) => "replaces" in a && a.replaces === run.id))
                  .map((run) => (
                    <rect
                      key={run.id}
                      data-run-id={run.id}
                      x={run.x - 1}
                      y={run.y - 1}
                      width={run.w + 2}
                      height={run.h + 2}
                      rx={1.5}
                      className="cursor-text fill-accent/5 stroke-accent/50 transition-colors hover:fill-accent/20"
                      strokeWidth={0.8}
                      strokeDasharray="3 2"
                    />
                  ))}

              <AnnotationShapes
                annotations={page.annotations}
                hiddenId={editing?.id}
                interactive={tool === "select" || tool === "text" || tool === "editText"}
              />

              {page.crop && (
                <>
                  <path
                    d={`M0 0H${pw}V${ph}H0Z M${page.crop.x} ${page.crop.y}v${page.crop.h}h${page.crop.w}v${-page.crop.h}Z`}
                    fill="rgb(15 23 42 / 0.45)"
                    fillRule="evenodd"
                    pointerEvents="none"
                  />
                  <rect
                    x={page.crop.x}
                    y={page.crop.y}
                    width={page.crop.w}
                    height={page.crop.h}
                    fill="none"
                    stroke="#1786f9"
                    strokeWidth={1.5 / scale}
                    strokeDasharray={`${6 / scale} ${4 / scale}`}
                    pointerEvents="none"
                  />
                </>
              )}

              {selected && selectedBounds && tool === "select" && !editing && (
                <g>
                  <rect
                    x={selectedBounds.x - pad}
                    y={selectedBounds.y - pad}
                    width={selectedBounds.w + pad * 2}
                    height={selectedBounds.h + pad * 2}
                    fill="none"
                    stroke="#1786f9"
                    strokeWidth={1.2 / scale}
                    strokeDasharray={`${4 / scale} ${3 / scale}`}
                    pointerEvents="none"
                  />
                  {selected.type === "line"
                    ? [
                        ["p1", selected.x1, selected.y1],
                        ["p2", selected.x2, selected.y2],
                      ].map(([id, x, y]) => (
                        <circle key={id as string} data-handle={id} cx={x as number} cy={y as number} r={handleSize / 1.4} fill="#fff" stroke="#1786f9" strokeWidth={1.5 / scale} style={{ cursor: "crosshair" }} />
                      ))
                    : selected.type !== "ink" &&
                      [
                        ["nw", selectedBounds.x - pad, selectedBounds.y - pad, "nwse-resize"],
                        ["ne", selectedBounds.x + selectedBounds.w + pad, selectedBounds.y - pad, "nesw-resize"],
                        ["sw", selectedBounds.x - pad, selectedBounds.y + selectedBounds.h + pad, "nesw-resize"],
                        ["se", selectedBounds.x + selectedBounds.w + pad, selectedBounds.y + selectedBounds.h + pad, "nwse-resize"],
                      ].map(([id, x, y, c]) => (
                        <rect
                          key={id as string}
                          data-handle={id}
                          x={(x as number) - handleSize / 2}
                          y={(y as number) - handleSize / 2}
                          width={handleSize}
                          height={handleSize}
                          fill="#fff"
                          stroke="#1786f9"
                          strokeWidth={1.5 / scale}
                          style={{ cursor: c as string }}
                        />
                      ))}
                </g>
              )}
            </svg>

            {/* Form fields sit above the drawing layer while selecting. */}
            {formWidgets.map((f) => {
              const s: React.CSSProperties = {
                position: "absolute",
                left: f.rect.x * scale,
                top: f.rect.y * scale,
                width: f.rect.w * scale,
                height: f.rect.h * scale,
                fontSize: Math.max(8, Math.min(f.rect.h * 0.62, 14)) * scale,
                fontFamily: fontCss("plex"),
                pointerEvents: tool === "select" ? "auto" : "none",
              };
              const cls = "rounded-sm border border-accent/50 bg-accent-soft/60 px-1 text-foreground outline-none focus:border-accent focus:bg-white";
              const value = formValues[f.fieldName];
              if (f.type === "checkbox") {
                return <input key={f.key} type="checkbox" checked={Boolean(value)} onChange={(e) => onFormChange(f.fieldName, e.target.checked)} style={s} className="accent-accent" />;
              }
              if (f.type === "radio") {
                return <input key={f.key} type="radio" name={`${page.id}-${f.fieldName}`} checked={value === f.radioValue} onChange={() => onFormChange(f.fieldName, f.radioValue ?? "")} style={s} className="accent-accent" />;
              }
              if (f.type === "dropdown") {
                return (
                  <select key={f.key} value={String(value ?? "")} onChange={(e) => onFormChange(f.fieldName, e.target.value)} style={s} className={cls}>
                    <option value="" />
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                );
              }
              return f.multiline ? (
                <textarea key={f.key} value={String(value ?? "")} onChange={(e) => onFormChange(f.fieldName, e.target.value)} style={{ ...s, resize: "none" }} className={cls} />
              ) : (
                <input key={f.key} value={String(value ?? "")} onChange={(e) => onFormChange(f.fieldName, e.target.value)} style={s} className={cls} />
              );
            })}

            {editing && editing.type === "text" && (
              <textarea
                autoFocus
                value={editing.text}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const text = e.target.value;
                  setAnn(editing.id, (a) => ({ ...a, text }) as Annotation);
                }}
                onBlur={() => {
                  if (!editing.text.trim()) {
                    updatePage((p) => ({ ...p, annotations: p.annotations.filter((a) => a.id !== editing.id) }));
                    onSelect(null);
                  }
                  onEditingChange(null);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") e.currentTarget.blur();
                }}
                rows={editing.text.split("\n").length}
                spellCheck={false}
                className="absolute resize-none overflow-hidden rounded-sm bg-white/70 p-0 outline outline-1 outline-accent"
                style={{
                  left: editing.x * scale,
                  // Centre the first line's box on the drawn baseline.
                  top: (editing.y - ((editing.lineHeight ?? DEFAULT_LINE_HEIGHT) - 1) * 0.5 * editing.size + editing.size * 0.02) * scale,
                  width: (measureText(editing) + editing.size) * scale,
                  fontSize: editing.size * scale,
                  lineHeight: `${textLineHeight(editing.size, editing.lineHeight) * scale}px`,
                  fontFamily: fontCss(editing.font),
                  fontWeight: editing.bold ? 700 : 400,
                  fontStyle: editing.italic ? "italic" : "normal",
                  textDecoration: editing.underline ? "underline" : "none",
                  textAlign: editing.align ?? "left",
                  color: editing.color,
                }}
              />
            )}
          </div>

          {/* Watermark and page numbers preview in the page's final orientation. */}
          {(watermark.enabled || pageNumbers.enabled) && (
            <svg viewBox={`0 0 ${finalW} ${finalH}`} width={frameW} height={frameH} className="pointer-events-none absolute inset-0">
              {watermark.enabled && watermark.text.trim() && (
                <text
                  x={finalW / 2}
                  y={finalH / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={watermark.size}
                  fontWeight={700}
                  fill={watermark.color}
                  opacity={watermark.opacity}
                  transform={`rotate(${-theta} ${finalW / 2} ${finalH / 2})`}
                  style={{ fontFamily: fontCss("plex") }}
                >
                  {watermark.text}
                </text>
              )}
              {pageNumbers.enabled && (
                <text
                  x={horizontal === "left" ? margin : horizontal === "right" ? finalW - margin : finalW / 2}
                  y={vertical === "top" ? margin + pageNumbers.size * 0.75 : finalH - margin}
                  textAnchor={horizontal === "left" ? "start" : horizontal === "right" ? "end" : "middle"}
                  fontSize={pageNumbers.size}
                  fill="#333a40"
                  style={{ fontFamily: fontCss("plex") }}
                >
                  {label}
                </text>
              )}
            </svg>
          )}
        </div>
  );
}
