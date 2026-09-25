"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  BringToFront,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  SlidersHorizontal,
  X,
  Crop,
  Eraser,
  FileText,
  Files,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Highlighter,
  ImagePlus,
  Maximize,
  Minus,
  MousePointer2,
  MoveUpRight,
  PaintBucket,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  SendToBack,
  Signature,
  Square,
  SquareDashed,
  TextCursorInput,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/dictionaries";
import { format as fill } from "@/lib/i18n";
import { saveBlob, zipFiles } from "@/lib/files";
import { baseName } from "@/lib/image-convert";
import { getPdfFont, getPdfPageSizes, getTextRuns, releasePdf, renderPdfPageToImage, type TextRun } from "@/lib/pdf-convert";
import { sampleTextColors } from "@/lib/pdf-studio/sample-colors";
import { PdfToolError, pdfPageCount } from "@/lib/pdf-tools";
import { exportStudioPdf } from "@/lib/pdf-studio/export";
import { readFormFields } from "@/lib/pdf-studio/forms";
import { readMetadata, type PdfMetadata, type PdfMetadataInfo } from "@/lib/pdf-studio/metadata";
import type {
  Annotation,
  DocOptions,
  FormValue,
  FormWidget,
  PageNumberPosition,
  StudioPage,
  Tool,
} from "@/lib/pdf-studio/types";
import FileDropZone from "@/components/FileDropZone";
import SupportNote from "@/components/SupportNote";
import PageEditor, { type PendingImage, type StyleState } from "./studio/PageEditor";
import PageOrganizer from "./studio/PageOrganizer";
import PageThumb from "./studio/PageThumb";
import TextProps, { type TextStyle } from "./studio/TextProps";
import { DEFAULT_FONT, fontForPdfText, matchFont } from "@/lib/pdf-studio/fonts";
import { RUN_KEYS, applyRunStyle, rangeStyle, replaceText } from "@/lib/pdf-studio/rich-text";
import { DEFAULT_LINE_HEIGHT } from "@/lib/pdf-studio/types";
import SignatureDialog, { type SignatureImage } from "./studio/SignatureDialog";

type T = Dictionary["editPdf"]["ui"];
type FileForms = { widgets: FormWidget[]; values: Record<string, FormValue> };

const sourceKey = (page: StudioPage) => `${page.file.name}|${page.file.lastModified}|${page.file.size}|${page.index}`;
const HISTORY_LIMIT = 60;
const COLORS = ["#10151c", "#dc2626", "#ea580c", "#16a34a", "#1786f9", "#7c3aed", "#db2777", "#ffffff"];
const WIDTHS = [1, 2, 3, 5, 8];
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((z) => z * (96 / 72));
const newId = () => Math.random().toString(36).slice(2, 10);
const PANELS_KEY = "sky-tools:pdf-studio:panels";

const DESKTOP_QUERY = "(min-width: 1024px)";

/** True on desktop-width screens, which get side panels; smaller screens get a bottom sheet. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(DESKTOP_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

function readPanels(): { left: boolean; right: boolean } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PANELS_KEY) ?? "null");
    if (saved && typeof saved.left === "boolean" && typeof saved.right === "boolean") return saved;
  } catch {
    // Storage unavailable (private mode, blocked): use the defaults.
  }
  return { left: false, right: true };
}

const TOOLS: { tool: Tool; icon: LucideIcon; key?: string }[] = [
  { tool: "select", icon: MousePointer2, key: "v" },
  { tool: "editText", icon: TextCursorInput, key: "e" },
  { tool: "text", icon: Type, key: "t" },
  { tool: "signature", icon: Signature },
  { tool: "image", icon: ImagePlus },
  { tool: "pen", icon: Pencil, key: "d" },
  { tool: "highlighter", icon: Highlighter },
  { tool: "highlight", icon: SquareDashed },
  { tool: "whiteout", icon: Eraser },
  { tool: "rect", icon: Square },
  { tool: "ellipse", icon: Circle },
  { tool: "line", icon: Minus },
  { tool: "arrow", icon: MoveUpRight },
  { tool: "crop", icon: Crop },
];

export default function EditPdfClient({ t, support }: { t: T; support: Dictionary["support"] }) {
  // ----- document state -----
  const [pages, setPages] = useState<StudioPage[]>([]);
  const [past, setPast] = useState<StudioPage[][]>([]);
  const [future, setFuture] = useState<StudioPage[][]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [forms, setForms] = useState<Map<File, FileForms>>(new Map());
  const [metaInfo, setMetaInfo] = useState<PdfMetadataInfo | null>(null);
  const [docOptions, setDocOptions] = useState<DocOptions>({
    metadata: { title: "", author: "", subject: "", keywords: "" },
    created: null,
    watermark: { enabled: false, text: t.document.watermarkDefault, size: 60, color: "#dc2626", opacity: 0.2 },
    pageNumbers: { enabled: false, position: "bottom-center", template: t.document.templates[0], start: 1, size: 11 },
  });

  // ----- view state -----
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [style, setStyle] = useState<StyleState>({
    color: "#10151c",
    fill: null,
    strokeWidth: 2,
    fontSize: 16,
    bold: false,
    font: DEFAULT_FONT,
    italic: false,
    underline: false,
    align: "left",
    lineHeight: DEFAULT_LINE_HEIGHT,
  });
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Characters selected in the text being edited: formatting then applies to just those.
  const [textSelection, setTextSelection] = useState<{ id: string; start: number; end: number } | null>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [panel, setPanel] = useState<"page" | "object" | "document">("page");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signatures, setSignatures] = useState<SignatureImage[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const isDesktop = useIsDesktop();
  // Phones and tablets: the tools panel is a bottom sheet, closed until asked for.
  const [sheetOpen, setSheetOpen] = useState(false);
  // The studio only shows panels after a file is opened, so reading storage here can't cause a hydration mismatch.
  const [panels, setPanels] = useState(() => (typeof window === "undefined" ? { left: false, right: true } : readPanels()));
  const railListRef = useRef<HTMLOListElement>(null);
  const [textRuns, setTextRuns] = useState<Record<string, TextRun[]>>({});
  const loadingRuns = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"image/jpeg" | "image/png">("image/jpeg");
  const [exportScope, setExportScope] = useState<"current" | "selected" | "all">("current");
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const nextId = useRef(0);
  const anchor = useRef(0);
  const renderingThumb = useRef(false);
  const renderingPreview = useRef<string | null>(null);
  const urlsRef = useRef<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [areaWidth, setAreaWidth] = useState(800);
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const imageInput = useRef<HTMLInputElement>(null);

  const currentIndex = Math.max(0, pages.findIndex((p) => p.id === currentId));
  const current = pages[currentIndex] as StudioPage | undefined;
  const currentPageId = current?.id;
  const targets = useMemo(
    () => (selected.size > 0 ? selected : new Set(currentPageId !== undefined ? [currentPageId] : [])),
    [selected, currentPageId],
  );
  const selectedAnn = current?.annotations.find((a) => a.id === selectedAnnId);

  // ----- history -----
  const beginChange = useCallback(() => {
    setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), pages]);
    setFuture([]);
  }, [pages]);

  const commit = useCallback(
    (next: StudioPage[]) => {
      setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), pages]);
      setFuture([]);
      setPages(next);
    },
    [pages],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    setFuture((f) => [pages, ...f]);
    setPages(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setEditingId(null);
  }, [past, pages]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    setPast((p) => [...p, pages]);
    setPages(future[0]);
    setFuture((f) => f.slice(1));
  }, [future, pages]);

  /** Live update of the current page (history is recorded by beginChange). */
  const updateCurrent = useCallback(
    (fn: (page: StudioPage) => StudioPage) => {
      setPages((prev) => prev.map((p) => (p.id === currentPageId ? fn(p) : p)));
    },
    [currentPageId],
  );

  /** Live update of any page by id (history is recorded by beginChange). */
  const updatePageById = useCallback((id: number, fn: (page: StudioPage) => StudioPage) => {
    setPages((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  }, []);

  const updateSelectedAnn = useCallback(
    (fn: (a: Annotation) => Annotation) => {
      if (!selectedAnnId) return;
      beginChange();
      updateCurrent((p) => ({ ...p, annotations: p.annotations.map((a) => (a.id === selectedAnnId ? fn(a) : a)) }));
    },
    [beginChange, selectedAnnId, updateCurrent],
  );

  // ----- page images -----
  const remember = (url: string) => {
    urlsRef.current.push(url);
    return url;
  };
  useEffect(() => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  useEffect(() => {
    if (renderingPreview.current) return;
    const wanted = [current, ...pages.filter((p) => visibleIds.includes(p.id))].filter(Boolean) as StudioPage[];
    const next = wanted.find((p) => previews[sourceKey(p)] === undefined);
    if (!next) return;
    const key = sourceKey(next);
    renderingPreview.current = key;
    renderPdfPageToImage(next.file, next.index + 1, "image/jpeg", 0.88, 2)
      .then((blob) => remember(URL.createObjectURL(blob)))
      .catch(() => "")
      .then((url) => {
        renderingPreview.current = null;
        setPreviews((prev) => ({ ...prev, [key]: url }));
      });
  }, [current, pages, visibleIds, previews]);

  useEffect(() => {
    if (renderingThumb.current) return;
    const missing = pages.find((page) => thumbs[sourceKey(page)] === undefined);
    if (!missing) return;
    renderingThumb.current = true;
    const key = sourceKey(missing);
    renderPdfPageToImage(missing.file, missing.index + 1, "image/jpeg", 0.7, 0.3)
      .then((blob) => remember(URL.createObjectURL(blob)))
      .catch(() => "")
      .then((url) => {
        renderingThumb.current = false;
        setThumbs((prev) => ({ ...prev, [key]: url }));
      });
  }, [pages, thumbs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setAreaWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [files.length]);

  // The page taking up the most of the view becomes the current page. Measured on
  // scroll (throttled) rather than with IntersectionObserver so it is exact and cheap.
  const pageIdsKey = pages.map((p) => p.id).join(",");
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let queued = false;
    function measure() {
      queued = false;
      const view = root!.getBoundingClientRect();
      const onScreen: number[] = [];
      let best: number | null = null;
      let bestHeight = 0;
      root!.querySelectorAll<HTMLElement>("[data-canvas-page]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const height = Math.min(r.bottom, view.bottom) - Math.max(r.top, view.top);
        if (height <= 0) return;
        const id = Number(el.dataset.canvasPage);
        onScreen.push(id);
        if (height > bestHeight) {
          best = id;
          bestHeight = height;
        }
      });
      setVisibleIds((prev) => (prev.join(",") === onScreen.join(",") ? prev : onScreen));
      if (best === null) return;
      const id: number = best;
      setCurrentId(id);
      // Follow the scroll with the page selection, unless several pages are selected on purpose.
      setSelected((prev) => (prev.size <= 1 && !prev.has(id) ? new Set([id]) : prev));
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      setTimeout(measure, 80);
    }
    measure();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [pageIdsKey]);

  useEffect(() => {
    if (tool !== "editText" || loadingRuns.current) return;
    const wanted = [current, ...pages.filter((p) => visibleIds.includes(p.id))].filter(Boolean) as StudioPage[];
    const next = wanted.find((p) => textRuns[sourceKey(p)] === undefined);
    if (!next) return;
    const key = sourceKey(next);
    loadingRuns.current = key;
    getTextRuns(next.file, next.index)
      .catch(() => [] as TextRun[])
      .then((runs) => {
        loadingRuns.current = null;
        setTextRuns((prev) => ({ ...prev, [key]: runs }));
      });
  }, [tool, current, pages, visibleIds, textRuns]);

  // Ctrl/⌘ + mouse wheel zooms the canvas.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((z) => {
        const now = z === "fit" ? ZOOMS[2] : z;
        return event.deltaY < 0
          ? (ZOOMS.find((v) => v > now + 0.001) ?? ZOOMS[ZOOMS.length - 1])
          : (ZOOMS.filter((v) => v < now - 0.001).pop() ?? ZOOMS[0]);
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [files.length]);

  // On narrow screens the toolbars scroll sideways; let a mouse wheel do that too.
  useEffect(() => {
    function onWheel(event: WheelEvent) {
      const row = (event.target as Element).closest?.<HTMLElement>("[data-hscroll]");
      if (!row || row.scrollWidth <= row.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      // Menus opened from the row (e.g. the font list) scroll themselves.
      for (let el = event.target as HTMLElement | null; el && el !== row; el = el.parentElement) {
        if (el.getAttribute("role") === "dialog" || el.scrollHeight > el.clientHeight + 1) return;
      }
      event.preventDefault();
      row.scrollLeft += event.deltaY;
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // Two fingers pinch to zoom and drag to pan (one finger scrolls, or draws with a drawing tool).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const area: HTMLDivElement = el;
    let pinch: { dist: number; scale: number; x: number; y: number } | null = null;
    let frame = 0;
    const center = (e: TouchEvent) => {
      const r = el.getBoundingClientRect();
      return {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
      };
    };
    const distance = (e: TouchEvent) =>
      Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    // Pages at "fit" each have their own scale; zooming starts from the one on screen.
    const currentScale = () => {
      const node = el.querySelector<HTMLElement>("[data-canvas-page][data-current]") ?? el.querySelector<HTMLElement>("[data-canvas-page]");
      return Number(node?.dataset.scale) || ZOOMS[2];
    };
    function onStart(e: TouchEvent) {
      if (e.touches.length !== 2) return;
      pinch = { dist: distance(e), scale: currentScale(), ...center(e) };
    }
    function onMove(e: TouchEvent) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const dist = distance(e);
      const c = center(e);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!pinch) return;
        const before = currentScale();
        const next = Math.min(ZOOMS[ZOOMS.length - 1], Math.max(ZOOMS[0], (pinch.scale * dist) / pinch.dist));
        const ratio = next / before;
        const left = area.scrollLeft;
        const top = area.scrollTop;
        if (Math.abs(ratio - 1) > 0.01) flushSync(() => setZoom(next));
        const applied = currentScale() / before;
        // Keep the point between the fingers still, then follow the fingers.
        area.scrollLeft = (left + pinch.x) * applied - c.x;
        area.scrollTop = (top + pinch.y) * applied - c.y;
        pinch.x = c.x;
        pinch.y = c.y;
      });
    }
    function onEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinch = null;
    }
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [files.length]);

  const scrollToPage = useCallback((id: number) => {
    scrollRef.current
      ?.querySelector(`[data-canvas-page="${id}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  // Selecting an object opens its panel.
  const selectAnn = useCallback((id: string | null) => {
    setSelectedAnnId(id);
    setTextSelection(null);
    if (id) setPanel("object");
  }, []);

  const togglePanel = useCallback((side: "left" | "right") => {
    setPanels((prev) => {
      const next = { ...prev, [side]: !prev[side] };
      try {
        window.localStorage.setItem(PANELS_KEY, JSON.stringify(next));
      } catch {
        // Not saved; the panel still toggles for this visit.
      }
      return next;
    });
  }, []);

  // Keep the current page's thumbnail visible in the left panel.
  useEffect(() => {
    if (!panels.left) return;
    railListRef.current?.querySelector(`[data-rail-page="${currentId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentId, panels.left]);

  // ----- files -----
  function describe(err: unknown): string {
    if (err instanceof PdfToolError) return fill(t[err.code], { file: err.fileName });
    return t.failed;
  }

  async function addFiles(picked: File[]) {
    setError(null);
    let added: StudioPage[] = [];
    const newFiles: File[] = [];
    const newForms = new Map(forms);
    for (const file of picked) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) continue;
      try {
        await pdfPageCount(file); // rejects encrypted or broken files with a clear error
        const sizes = await getPdfPageSizes(file);
        newFiles.push(file);
        added = [
          ...added,
          ...sizes.map((size, index) => ({ id: nextId.current++, file, index, rotation: 0, size, annotations: [], crop: null })),
        ];
        const fileForms = await readFormFields(file).catch(() => null);
        if (fileForms && fileForms.widgets.length > 0) newForms.set(file, fileForms);
      } catch (err) {
        setError(describe(err));
      }
    }
    if (added.length === 0) return;
    if (files.length === 0 && newFiles[0]) {
      const read = await readMetadata(newFiles[0]).catch(() => null);
      if (read) {
        setMetaInfo(read.info);
        setDocOptions((o) => ({ ...o, metadata: read.metadata, created: read.info.created }));
      }
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setForms(newForms);
    commit([...pages, ...added]);
    if (currentId === null) {
      setCurrentId(added[0].id);
      setSelected(new Set([added[0].id]));
    }
  }

  // ----- page actions -----
  const goTo = useCallback(
    (index: number) => {
      const page = pages[Math.min(Math.max(index, 0), pages.length - 1)];
      if (!page) return;
      setCurrentId(page.id);
      setSelected(new Set([page.id]));
      setSelectedAnnId(null);
      anchor.current = pages.indexOf(page);
      scrollToPage(page.id);
    },
    [pages, scrollToPage],
  );

  const rotatePages = useCallback(
    (by: number, all = false) => commit(pages.map((p) => (all || targets.has(p.id) ? { ...p, rotation: p.rotation + by } : p))),
    [commit, pages, targets],
  );

  const removePages = useCallback(() => {
    if (targets.size === 0) return;
    const remaining = pages.filter((p) => !targets.has(p.id));
    const firstRemoved = pages.findIndex((p) => targets.has(p.id));
    const nextCurrent = remaining[Math.min(firstRemoved, remaining.length - 1)];
    commit(remaining);
    setCurrentId(nextCurrent?.id ?? null);
    setSelected(new Set(nextCurrent ? [nextCurrent.id] : []));
  }, [commit, pages, targets]);

  function duplicatePages() {
    const copies: StudioPage[] = [];
    const next = pages.flatMap((p) => {
      if (!targets.has(p.id)) return [p];
      const copy = { ...p, id: nextId.current++, annotations: p.annotations.map((a) => ({ ...a, id: newId() })) };
      copies.push(copy);
      return [p, copy];
    });
    commit(next);
    setSelected(new Set(copies.map((c) => c.id)));
    if (copies[0]) setCurrentId(copies[0].id);
  }

  function movePages(direction: -1 | 1) {
    const next = [...pages];
    const order = direction === -1 ? next.map((_, i) => i) : next.map((_, i) => next.length - 1 - i);
    for (const i of order) {
      const j = i + direction;
      if (!targets.has(next[i].id) || j < 0 || j >= next.length || targets.has(next[j].id)) continue;
      [next[i], next[j]] = [next[j], next[i]];
    }
    commit(next);
  }

  /** Moves the pages with these ids (keeping their order) to start at `insertBefore`. */
  function reorderPages(ids: number[], insertBefore: number) {
    const moving = pages.filter((p) => ids.includes(p.id));
    const rest = pages.filter((p) => !ids.includes(p.id));
    const at = pages.slice(0, insertBefore).filter((p) => !ids.includes(p.id)).length;
    const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
    if (next.every((p, i) => p.id === pages[i].id)) return;
    commit(next);
  }

  // The organizer starts with nothing selected, so bulk actions only touch pages picked there.
  function openOrganizer() {
    setSelected(new Set());
    setOrganizerOpen(true);
  }

  function openPage(id: number) {
    setOrganizerOpen(false);
    setCurrentId(id);
    setSelected(new Set([id]));
    setSelectedAnnId(null);
    // Wait for the modal to close before scrolling the canvas.
    setTimeout(() => scrollToPage(id), 50);
  }

  async function editRun(page: StudioPage, run: TextRun) {
    const image = previews[sourceKey(page)] || thumbs[sourceKey(page)];
    const original = getPdfFont(page.file, run.fontKey);
    const [colors, match] = await Promise.all([
      image ? sampleTextColors(image, page.size, run) : { background: "#ffffff", foreground: "#000000" },
      // Keep the look of the original text: its own font when possible.
      original
        ? fontForPdfText(original, run.text).catch(() => ({ font: matchFont(run.fontName), ownStyle: false }))
        : { font: matchFont(run.fontName), ownStyle: false },
    ]);
    const pad = Math.max(1, run.size * 0.12);
    const cover: Annotation = {
      type: "rect",
      id: newId(),
      x: run.x - pad,
      y: run.y - pad,
      w: run.w + pad * 2,
      h: run.h + pad * 2,
      stroke: null,
      fill: colors.background,
      strokeWidth: 0,
      opacity: 1,
      role: "whiteout",
      replaces: run.id,
    };
    const text: Annotation = {
      type: "text",
      id: newId(),
      x: run.x,
      // Our text layout puts the first baseline at 0.95 × size below the box top.
      y: run.baseline - run.size * 0.95,
      text: run.text,
      size: Math.round(run.size * 10) / 10,
      color: colors.foreground,
      bold: !match.ownStyle && run.bold,
      font: match.font,
      italic: !match.ownStyle && /italic|oblique/i.test(run.fontName),
      underline: false,
      align: "left",
      lineHeight: DEFAULT_LINE_HEIGHT,
      replaces: run.id,
    };
    beginChange();
    updatePageById(page.id, (p) => ({ ...p, annotations: [...p.annotations, cover, text] }));
    setCurrentId(page.id);
    selectAnn(text.id);
    setEditingId(text.id);
  }

  // ----- annotation actions -----
  const deleteAnn = useCallback(() => {
    if (!selectedAnnId) return;
    beginChange();
    updateCurrent((p) => {
      const target = p.annotations.find((a) => a.id === selectedAnnId);
      const pair = target && "replaces" in target ? target.replaces : undefined;
      return {
        ...p,
        annotations: p.annotations.filter((a) => a.id !== selectedAnnId && !(pair && "replaces" in a && a.replaces === pair)),
      };
    });
    setSelectedAnnId(null);
  }, [beginChange, selectedAnnId, updateCurrent]);

  function duplicateAnn() {
    if (!selectedAnn) return;
    const copy = { ...selectedAnn, id: newId() } as Annotation;
    const shifted: Annotation =
      copy.type === "line"
        ? { ...copy, x1: copy.x1 + 12, y1: copy.y1 + 12, x2: copy.x2 + 12, y2: copy.y2 + 12 }
        : copy.type === "ink"
          ? { ...copy, points: copy.points.map((v) => v + 12) }
          : { ...copy, x: copy.x + 12, y: copy.y + 12 };
    beginChange();
    updateCurrent((p) => ({ ...p, annotations: [...p.annotations, shifted] }));
    selectAnn(shifted.id);
  }

  function reorderAnn(toFront: boolean) {
    if (!selectedAnn) return;
    beginChange();
    updateCurrent((p) => {
      const rest = p.annotations.filter((a) => a.id !== selectedAnn.id);
      return { ...p, annotations: toFront ? [...rest, selectedAnn] : [selectedAnn, ...rest] };
    });
  }

  /** Style controls change the selected object, or the style for new ones. */
  const applyStyle = useCallback(
    (patch: Partial<StyleState>) => {
      setStyle((s) => ({ ...s, ...patch }));
      if (!selectedAnn) return;
      updateSelectedAnn((a) => {
        if (a.type === "text") {
          const next = {
            ...a,
            size: patch.fontSize ?? a.size,
            font: patch.font ?? a.font,
            align: patch.align ?? a.align,
            lineHeight: patch.lineHeight ?? a.lineHeight,
          };
          // Whole-object formatting also replaces any formatting on parts of the text.
          const { bold, italic, underline, color } = patch;
          return applyRunStyle(next, 0, next.text.length, { bold, italic, underline, color });
        }
        if (a.type === "line") return { ...a, stroke: patch.color ?? a.stroke, strokeWidth: patch.strokeWidth ?? a.strokeWidth };
        if (a.type === "ink") return { ...a, stroke: patch.color ?? a.stroke, strokeWidth: patch.strokeWidth ?? a.strokeWidth };
        if ((a.type === "rect" || a.type === "ellipse") && !a.role)
          return {
            ...a,
            stroke: patch.color ?? a.stroke,
            strokeWidth: patch.strokeWidth ?? a.strokeWidth,
            fill: patch.fill !== undefined ? patch.fill : a.fill,
          };
        if (a.type === "rect" && patch.color && a.role === "highlight") return { ...a, fill: patch.color };
        return a;
      });
    },
    [selectedAnn, updateSelectedAnn],
  );

  function chooseTool(next: Tool) {
    setEditingId(null);
    setTextSelection(null);
    setSelectedAnnId(null);
    setPendingImage(null);
    setTool(next);
    if (next === "signature") setSignatureOpen(true);
    if (next === "image") imageInput.current?.click();
  }

  async function pickImage(file: File | undefined) {
    if (!file || !current) return;
    const src = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    // Normalise to PNG/JPEG (the formats PDF can hold) and measure it.
    const bitmap = await createImageBitmap(file);
    const isJpeg = file.type === "image/jpeg";
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    const data = file.type === "image/png" || isJpeg ? src : canvas.toDataURL("image/png");
    const maxW = current.size.w * 0.4;
    const w = Math.min(maxW, bitmap.width * 0.75);
    setPendingImage({ src: data, w, h: (w * bitmap.height) / bitmap.width, kind: "image" });
    bitmap.close();
  }

  function useSignature(sig: SignatureImage) {
    setSignatures((prev) => [sig, ...prev.filter((s) => s.src !== sig.src)].slice(0, 6));
    const w = 150;
    setPendingImage({ src: sig.src, w, h: (w * sig.height) / sig.width, kind: "signature" });
    setSignatureOpen(false);
    setTool("signature");
  }

  const onPlaced = useCallback(() => {
    setPendingImage(null);
    setTool("select");
  }, []);

  // ----- forms -----
  const widgetsFor = (page: StudioPage) => forms.get(page.file)?.widgets.filter((w) => w.pageIndex === page.index) ?? [];
  const totalFields = [...forms.values()].reduce((n, f) => n + new Set(f.widgets.map((w) => w.fieldName)).size, 0);

  function setFormValue(file: File, fieldName: string, value: FormValue) {
    setForms((prev) => {
      const next = new Map(prev);
      const entry = next.get(file);
      if (entry) next.set(file, { ...entry, values: { ...entry.values, [fieldName]: value } });
      return next;
    });
  }

  // ----- save & export -----
  const buildPdf = useCallback(
    () =>
      exportStudioPdf({
        pages,
        options: docOptions,
        formValues: new Map([...forms].map(([file, f]) => [file, f.values])),
      }),
    [pages, docOptions, forms],
  );

  const save = useCallback(async () => {
    if (pages.length === 0 || saving) return;
    setEditingId(null);
    setSaving(true);
    setError(null);
    try {
      saveBlob(await buildPdf(), `${baseName(files[0]?.name ?? "document")}-edited.pdf`);
      setDownloaded(true);
    } catch (err) {
      console.error(err);
      setError(describe(err));
    } finally {
      setSaving(false);
    }
    // describe only reads dictionary text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, saving, files, buildPdf]);

  async function exportImages() {
    const indices =
      exportScope === "all"
        ? pages.map((_, i) => i)
        : exportScope === "selected"
          ? pages.map((p, i) => (targets.has(p.id) ? i : -1)).filter((i) => i >= 0)
          : [currentIndex];
    if (indices.length === 0) return;
    setExporting(true);
    setError(null);
    const pdf = new File([await buildPdf().catch(() => new Blob())], "studio.pdf", { type: "application/pdf" });
    try {
      const ext = exportFormat === "image/png" ? "png" : "jpg";
      const stem = baseName(files[0]?.name ?? "page");
      const images = [];
      for (const i of indices) {
        images.push({ name: `${stem}-page-${i + 1}.${ext}`, data: await renderPdfPageToImage(pdf, i + 1, exportFormat, 0.92, 2) });
      }
      if (images.length === 1) saveBlob(images[0].data, images[0].name);
      else saveBlob(await zipFiles(images), `${stem}-pages.zip`);
      setDownloaded(true);
    } catch (err) {
      console.error(err);
      setError(t.failed);
    } finally {
      releasePdf(pdf);
      setExporting(false);
    }
  }

  function startOver() {
    files.forEach(releasePdf);
    setPages([]);
    setPast([]);
    setFuture([]);
    setFiles([]);
    setForms(new Map());
    setMetaInfo(null);
    setDocOptions((o) => ({ ...o, metadata: { title: "", author: "", subject: "", keywords: "" }, created: null }));
    setSelected(new Set());
    setCurrentId(null);
    setSelectedAnnId(null);
    setEditingId(null);
    setError(null);
  }

  // ----- keyboard -----
  useEffect(() => {
    if (pages.length === 0) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) return;
      if (signatureOpen || organizerOpen) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const nudge = event.shiftKey ? 10 : 1;
      if (mod && selectedAnn?.type === "text" && (key === "b" || key === "i" || key === "u")) {
        const prop = key === "b" ? "bold" : key === "i" ? "italic" : "underline";
        applyStyle({ [prop]: !selectedAnn[prop] });
      } else if (mod && key === "z" && !event.shiftKey) undo();
      else if (mod && (key === "y" || (key === "z" && event.shiftKey))) redo();
      else if (mod && key === "s") void save();
      else if (mod && key === "a") setSelected(new Set(pages.map((p) => p.id)));
      else if (!mod && selectedAnnId && event.key.startsWith("Arrow")) {
        const dx = event.key === "ArrowLeft" ? -nudge : event.key === "ArrowRight" ? nudge : 0;
        const dy = event.key === "ArrowUp" ? -nudge : event.key === "ArrowDown" ? nudge : 0;
        updateSelectedAnn((a) =>
          a.type === "line"
            ? { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy }
            : a.type === "ink"
              ? { ...a, points: a.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) }
              : { ...a, x: a.x + dx, y: a.y + dy },
        );
      } else if (!mod && event.key === "ArrowLeft") goTo(currentIndex - 1);
      else if (!mod && event.key === "ArrowRight") goTo(currentIndex + 1);
      else if (!mod && (event.key === "Delete" || event.key === "Backspace")) {
        if (selectedAnnId) deleteAnn();
        else removePages();
      } else if (event.key === "Escape") {
        setSelectedAnnId(null);
        setPendingImage(null);
        setTool("select");
      } else if (!mod && key === "r") rotatePages(event.shiftKey ? -90 : 90);
      else if (!mod && key === "p") openOrganizer();
      else if (!mod && event.key === "[") togglePanel("left");
      else if (!mod && event.key === "]") togglePanel("right");
      else if (!mod && TOOLS.some((x) => x.key === key)) chooseTool(TOOLS.find((x) => x.key === key)!.tool);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages, currentIndex, selectedAnnId, selectedAnn, applyStyle, signatureOpen, organizerOpen, togglePanel, undo, redo, save, goTo, rotatePages, removePages, deleteAnn, updateSelectedAnn]);

  // ----- render -----
  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="w-full max-w-xl">
          <FileDropZone title={t.dropTitle} hint={t.dropHint} accept="application/pdf,.pdf" onFiles={addFiles} />
          {error && <p className="mt-4 rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>}
        </div>
      </div>
    );
  }

  const iconButton =
    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-muted hover:bg-background hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  // Side panels and zoom buttons: desktop only (touch screens use the sheet and pinch).
  const desktopButton = iconButton.replace("inline-flex ", "hidden lg:inline-flex ");
  const panelButton =
    "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent-hover disabled:opacity-40 disabled:hover:border-border disabled:hover:text-inherit";
  const field = "rounded-lg border border-border bg-background-raised px-2 py-1.5 text-sm focus:border-accent focus:outline-none";
  const label = "flex flex-col gap-1 text-xs font-semibold text-muted";

  // What the style bar edits: the selected object, or the active drawing tool.
  const styleTarget: string | null =
    selectedAnn
      ? selectedAnn.type === "rect" || selectedAnn.type === "ellipse"
        ? selectedAnn.role ?? selectedAnn.type
        : selectedAnn.type
      : tool;
  const showColor = !["select", "editText", "text", "crop", "image", "signature", "whiteout", "highlighter"].includes(styleTarget ?? "");
  const showWidth = ["pen", "highlighter", "rect", "ellipse", "line", "arrow", "ink"].includes(styleTarget ?? "");
  const showFont = styleTarget === "text";
  const showFill = styleTarget === "rect" || styleTarget === "ellipse";
  const activeColor =
    selectedAnn
      ? selectedAnn.type === "text"
        ? selectedAnn.color
        : selectedAnn.type === "line" || selectedAnn.type === "ink"
          ? selectedAnn.stroke
          : selectedAnn.type === "rect" || selectedAnn.type === "ellipse"
            ? selectedAnn.role === "highlight"
              ? selectedAnn.fill ?? style.color
              : selectedAnn.stroke ?? style.color
            : style.color
      : style.color;

  // Text formatting shown for the selected text, or the defaults for new text.
  const textTarget = selectedAnn?.type === "text" ? selectedAnn : null;
  const partSelected =
    textTarget && textSelection?.id === textTarget.id && textSelection.start !== textSelection.end ? textSelection : null;
  const runStyle = textTarget
    ? partSelected
      ? rangeStyle(textTarget, partSelected.start, partSelected.end)
      : rangeStyle(textTarget, 0, textTarget.text.length)
    : null;
  const textStyle: TextStyle = textTarget && runStyle
    ? {
        font: textTarget.font ?? "plex",
        size: textTarget.size,
        bold: runStyle.bold,
        italic: runStyle.italic,
        underline: runStyle.underline,
        align: textTarget.align ?? "left",
        lineHeight: textTarget.lineHeight ?? DEFAULT_LINE_HEIGHT,
        color: runStyle.color,
      }
    : {
        font: style.font,
        size: style.fontSize,
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
        align: style.align,
        lineHeight: style.lineHeight,
        color: style.color,
      };
  const applyTextStyle = (patch: Partial<TextStyle>) => {
    const { size, bold, italic, underline, color, ...rest } = patch;
    const run = { bold, italic, underline, color };
    if (partSelected && textTarget && RUN_KEYS.some((key) => run[key] !== undefined)) {
      // Bold, italic, underline, and color apply to just the selected characters.
      updateSelectedAnn((a) => (a.type === "text" ? applyRunStyle(a, partSelected.start, partSelected.end, run) : a));
      if (size !== undefined || Object.keys(rest).length) applyStyle({ ...rest, ...(size !== undefined ? { fontSize: size } : {}) });
      return;
    }
    const whole: Partial<StyleState> = { ...rest, ...(size !== undefined ? { fontSize: size } : {}) };
    for (const key of RUN_KEYS) if (run[key] !== undefined) Object.assign(whole, { [key]: run[key] });
    applyStyle(whole);
  };
  const showTextProps = showFont || (tool === "text" && !selectedAnn);

  const annTypeLabel = (a: Annotation) =>
    a.type === "image"
      ? t.object.types[a.kind]
      : a.type === "line"
        ? t.object.types[a.arrow ? "arrow" : "line"]
        : (a.type === "rect" || a.type === "ellipse") && a.role
          ? t.object.types[a.role]
          : t.object.types[a.type];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background-raised">
      {/* Main toolbar */}
      <div data-hscroll className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5 [scrollbar-width:thin] sm:px-3 lg:flex-wrap lg:overflow-visible">
        <button
          type="button"
          onClick={() => togglePanel("left")}
          aria-pressed={panels.left}
          title={`${panels.left ? t.panels.hideLeft : t.panels.showLeft} ([)`}
          aria-label={panels.left ? t.panels.hideLeft : t.panels.showLeft}
          className={desktopButton}
        >
          {panels.left ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
        <span className="mr-1 hidden min-w-0 items-center gap-2 px-1 text-sm font-semibold sm:flex">
          <FileText className="h-4 w-4 shrink-0 text-accent-hover" />
          <span className="max-w-[10rem] truncate">{files[0].name}</span>
          <span className="shrink-0 font-normal text-muted">· {fill(t.pageCount, { count: pages.length })}</span>
        </span>
        <button
          type="button"
          onClick={() => openOrganizer()}
          title={`${t.organizer.title} (P)`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent-hover"
        >
          <Files className="h-4 w-4" />
          {t.organizer.open}
          <span className="rounded-full bg-accent-soft px-1.5 text-xs text-accent-hover">{pages.length}</span>
        </button>
        <label className={`${iconButton} cursor-pointer`} title={t.addPages}>
          <Plus className="h-4 w-4" />
          <span className="hidden xl:inline">{t.addPages}</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              void addFiles(picked);
            }}
          />
        </label>
        <button type="button" onClick={undo} disabled={past.length === 0} title={`${t.undo} (Ctrl+Z)`} aria-label={t.undo} className={iconButton}>
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={redo} disabled={future.length === 0} title={`${t.redo} (Ctrl+Y)`} aria-label={t.redo} className={iconButton}>
          <Redo2 className="h-4 w-4" />
        </button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={() => setZoom((z) => ZOOMS.filter((v) => v < (z === "fit" ? ZOOMS[2] : z)).pop() ?? ZOOMS[0])} aria-label={t.zoomOut} title={t.zoomOut} className={desktopButton}>
          <ZoomOut className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setZoom("fit")} title={t.zoomFit} className={`${iconButton} ${zoom === "fit" ? "text-accent-hover" : ""}`}>
          <Maximize className="h-4 w-4" />
          <span className="hidden sm:inline">{zoom === "fit" ? t.zoomFit : `${Math.round((zoom / (96 / 72)) * 100)}%`}</span>
        </button>
        <button type="button" onClick={() => setZoom((z) => ZOOMS.find((v) => v > (z === "fit" ? ZOOMS[2] - 0.01 : z)) ?? ZOOMS[ZOOMS.length - 1])} aria-label={t.zoomIn} title={t.zoomIn} className={desktopButton}>
          <ZoomIn className="h-4 w-4" />
        </button>
        <div className="sticky right-0 ml-auto flex shrink-0 items-center gap-1 bg-background-raised pl-1 lg:static lg:pl-0">
          <button type="button" onClick={startOver} className={iconButton.replace("inline-flex ", "hidden sm:inline-flex ")}>
            {t.startOver}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={pages.length === 0 || saving}
            title="Ctrl+S"
            className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105 disabled:opacity-60"
          >
            {saving ? t.saving : t.save}
          </button>
          <button
            type="button"
            onClick={() => togglePanel("right")}
            aria-pressed={panels.right}
            title={`${panels.right ? t.panels.hideRight : t.panels.showRight} (])`}
            aria-label={panels.right ? t.panels.hideRight : t.panels.showRight}
            className={desktopButton}
          >
            {panels.right ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            aria-pressed={sheetOpen}
            aria-label={sheetOpen ? t.panels.hideRight : t.panels.showRight}
            className={`${iconButton} lg:hidden`}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tool palette + style bar */}
      <div className="flex flex-col gap-1 border-b border-border px-2 py-1.5 sm:px-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3">
        <div data-hscroll className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:thin] lg:flex-wrap lg:overflow-visible" role="toolbar">
          {TOOLS.map(({ tool: value, icon: Icon, key }) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseTool(value)}
              aria-pressed={tool === value}
              title={`${t.tools[value]}${key ? ` (${key.toUpperCase()})` : ""}`}
              aria-label={t.tools[value]}
              className={`shrink-0 rounded-lg p-2.5 lg:p-2 ${tool === value ? "bg-accent text-white shadow-sm" : "text-muted hover:bg-background hover:text-foreground"}`}
            >
              <Icon className="h-5 w-5 lg:h-4 lg:w-4" />
            </button>
          ))}
        </div>

        {(showColor || showWidth || showTextProps || showFill) && <span className="hidden h-6 w-px bg-border lg:block" />}
        <div data-hscroll className="flex items-center gap-x-3 overflow-x-auto [scrollbar-width:thin] empty:hidden lg:contents">

        {showColor && (
          <div className="flex shrink-0 items-center gap-1" aria-label={t.style.color}>
            {COLORS.filter((c) => c !== "#ffffff" || showFill).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => applyStyle({ color: c })}
                className={`h-5 w-5 rounded-full border ${activeColor === c ? "ring-2 ring-accent ring-offset-1" : "border-border"}`}
                style={{ background: c }}
              />
            ))}
            <input type="color" value={activeColor} onChange={(e) => applyStyle({ color: e.target.value })} aria-label={t.style.color} className="h-6 w-7 cursor-pointer rounded border border-border bg-transparent" />
          </div>
        )}
        {showWidth && (
          <label className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted">
            {t.style.width}
            <select
              value={selectedAnn && "strokeWidth" in selectedAnn && tool === "select" ? selectedAnn.strokeWidth : style.strokeWidth}
              onChange={(e) => applyStyle({ strokeWidth: Number(e.target.value) })}
              className={field}
            >
              {WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        )}
        {showTextProps && (
          <>
            <TextProps value={textStyle} onChange={applyTextStyle} t={t.textProps} pickerT={t.fontPicker} compact />
            <div
              data-text-format
              onMouseDown={(e) => {
                if ((e.target as Element).closest("button")) e.preventDefault();
              }}
              className="flex shrink-0 items-center gap-1"
              aria-label={t.style.color}
            >
              {COLORS.filter((col) => col !== "#ffffff").map((col) => (
                <button
                  key={col}
                  type="button"
                  aria-label={col}
                  onClick={() => applyTextStyle({ color: col })}
                  className={`h-5 w-5 rounded-full border ${textStyle.color === col ? "ring-2 ring-accent ring-offset-1" : "border-border"}`}
                  style={{ background: col }}
                />
              ))}
              <input type="color" value={textStyle.color} onChange={(e) => applyTextStyle({ color: e.target.value })} aria-label={t.style.color} className="h-6 w-7 cursor-pointer rounded border border-border bg-transparent" />
            </div>
          </>
        )}
        {showFill && (
          <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted">
            <PaintBucket className="h-4 w-4" />
            <button type="button" onClick={() => applyStyle({ fill: null })} className={`rounded px-1.5 py-0.5 ${(tool === "select" && selectedAnn && "fill" in selectedAnn ? selectedAnn.fill : style.fill) === null ? "bg-accent-soft text-accent-hover" : "hover:bg-background"}`}>
              {t.style.noFill}
            </button>
            {["#fde68a", "#bfdbfe", "#bbf7d0", "#fecaca", "#ffffff"].map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => applyStyle({ fill: c })} className="h-5 w-5 rounded border border-border" style={{ background: c }} />
            ))}
          </div>
        )}
        </div>
      </div>

      {error && <p className="border-b border-border bg-error-soft px-4 py-2 text-sm font-semibold text-error">{error}</p>}

      <div
        className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] transition-[grid-template-columns] duration-200 ease-out lg:[grid-template-columns:var(--studio-cols)]"
        style={{ "--studio-cols": `${panels.left ? "156px" : "0px"} minmax(0,1fr) ${panels.right ? "280px" : "0px"}` } as React.CSSProperties}
      >
        {/* Left panel: page thumbnails */}
        <aside
          inert={!panels.left}
          className={`hidden flex-col overflow-hidden border-border lg:flex lg:min-h-0 ${panels.left ? "lg:border-r" : ""}`}
        >
          <div className="flex min-w-[156px] items-center justify-between px-3 pb-1 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.pages}</p>
            <div className="flex">
              <button type="button" onClick={openOrganizer} title={`${t.organizer.title} (P)`} aria-label={t.organizer.title} className="rounded-md p-1.5 text-muted hover:bg-background hover:text-foreground">
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => togglePanel("left")} title={`${t.panels.hideLeft} ([)`} aria-label={t.panels.hideLeft} className="rounded-md p-1.5 text-muted hover:bg-background hover:text-foreground">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ol ref={railListRef} className="flex min-w-[156px] gap-3 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
            {pages.map((page, i) => (
              <li key={page.id} data-rail-page={page.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => openPage(page.id)}
                  aria-label={fill(t.pageLabel, { page: i + 1 })}
                  aria-current={page.id === current?.id ? "page" : undefined}
                  className={`flex w-24 flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition lg:w-full ${
                    page.id === current?.id ? "border-accent bg-accent-soft" : "border-transparent hover:border-border hover:bg-background"
                  }`}
                >
                  <PageThumb page={page} src={thumbs[sourceKey(page)] || undefined} />
                  <span className={`text-xs font-semibold ${page.id === current?.id ? "text-accent-hover" : "text-muted"}`}>{i + 1}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        {/* Canvas: all pages in one scrolling column */}
        <section className="relative min-h-0 bg-background">
          <div ref={scrollRef} className="absolute inset-0 overflow-auto overscroll-contain">
            {pages.length === 0 ? (
              <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">{t.empty}</p>
            ) : (
              <div className="mx-auto flex w-max min-w-full flex-col items-center gap-6 px-6 pb-16 pt-12">
                {pages.map((page, i) => {
                  const quarter = ((page.rotation % 180) + 180) % 180 === 90;
                  const finalWidth = quarter ? page.size.h : page.size.w;
                  const scale = zoom === "fit" ? Math.min(2.2, Math.max(0.2, (areaWidth - 64) / finalWidth)) : zoom;
                  const pageForms = forms.get(page.file);
                  return (
                    <div
                      key={page.id}
                      data-canvas-page={page.id}
                      data-scale={scale}
                      data-current={page.id === current?.id ? "" : undefined}
                      className="flex scroll-mt-10 flex-col items-center gap-2"
                    >
                      <div className={`rounded-sm ${page.id === current?.id ? "ring-2 ring-accent/60 ring-offset-4 ring-offset-background" : ""}`}>
                        <PageEditor
                          page={page}
                          imageUrl={previews[sourceKey(page)] || thumbs[sourceKey(page)] || undefined}
                          tool={tool}
                          style={style}
                          scale={scale}
                          onActivate={() => {
                            if (page.id === currentId) return;
                            setCurrentId(page.id);
                            setSelected(new Set([page.id]));
                          }}
                          selectedId={selectedAnnId}
                          onSelect={selectAnn}
                          editingId={editingId}
                          onEditingChange={setEditingId}
                          beginChange={beginChange}
                          updatePage={(fn) => updatePageById(page.id, fn)}
                          pendingImage={pendingImage}
                          onPlaced={onPlaced}
                          formWidgets={widgetsFor(page)}
                          formValues={pageForms?.values ?? {}}
                          onFormChange={(name, value) => setFormValue(page.file, name, value)}
                          docOptions={docOptions}
                          pageNumber={i + 1}
                          pageTotal={pages.length}
                          newTextLabel={t.newText}
                          textRuns={tool === "editText" ? textRuns[sourceKey(page)] : undefined}
                          onEditRun={(run) => void editRun(page, run)}
                          onTextSelection={setTextSelection}
                          onToggleRun={(prop) => applyTextStyle({ [prop]: !textStyle[prop] })}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!panels.left && (
            <button
              type="button"
              onClick={() => togglePanel("left")}
              title={`${t.panels.showLeft} ([)`}
              aria-label={t.panels.showLeft}
              className="absolute left-0 top-1/2 hidden -translate-y-1/2 rounded-r-lg border border-l-0 border-border bg-background-raised px-1 py-3 text-muted shadow-sm hover:text-accent-hover lg:block"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          {!panels.right && (
            <button
              type="button"
              onClick={() => togglePanel("right")}
              title={`${t.panels.showRight} (])`}
              aria-label={t.panels.showRight}
              className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-l-lg border border-r-0 border-border bg-background-raised px-1 py-3 text-muted shadow-sm hover:text-accent-hover lg:block"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          )}

          {current && (
            <>
              <p className="pointer-events-none absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 truncate rounded-full bg-foreground/80 px-3 py-1 text-xs font-medium text-white">
                {t.hints[tool]}
              </p>
              {!isDesktop && selectedAnn && !editingId && (
                <div className="absolute bottom-14 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background-raised p-1 text-sm font-semibold shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setPanel("object");
                      setSheetOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-background"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    {t.tabs.object}
                  </button>
                  <button type="button" onClick={duplicateAnn} aria-label={t.object.duplicate} className="rounded-full p-2.5 hover:bg-background">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={deleteAnn} aria-label={t.object.delete} className="rounded-full p-2.5 text-error hover:bg-error-soft">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground/80 px-1.5 py-1 text-xs font-semibold text-white">
                <button type="button" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} aria-label={t.previous} className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-30 lg:p-1">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-1">{fill(t.pageOf, { page: currentIndex + 1, count: pages.length })}</span>
                <button type="button" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex >= pages.length - 1} aria-label={t.next} className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-30 lg:p-1">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </section>

        {/* Inspector: side panel on desktop, bottom sheet on phones and tablets */}
        {!isDesktop && sheetOpen && (
          <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setSheetOpen(false)} aria-hidden="true" />
        )}
        <aside
          inert={isDesktop ? !panels.right : !sheetOpen}
          aria-label={t.panels.showRight}
          className={
            isDesktop
              ? `flex min-h-0 flex-col overflow-hidden border-border ${panels.right ? "border-l" : ""}`
              : sheetOpen
                ? "fixed inset-x-0 bottom-0 z-40 flex max-h-[70dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-background-raised shadow-2xl"
                : "hidden"
          }
        >
          {!isDesktop && (
            <div className="relative flex h-7 shrink-0 items-center justify-center">
              <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
              <button type="button" onClick={() => setSheetOpen(false)} aria-label={t.panels.hideRight} className="absolute right-2 top-1 rounded-lg p-2 text-muted hover:bg-background">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <div className="flex shrink-0 border-b border-border lg:min-w-[280px]" role="tablist">
            {(["page", "object", "document"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={panel === value}
                onClick={() => setPanel(value)}
                className={`flex-1 border-b-2 px-2 py-2.5 text-sm font-semibold ${panel === value ? "border-accent text-accent-hover" : "border-transparent text-muted hover:text-foreground"}`}
              >
                {t.tabs[value]}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-4 pb-8 lg:min-w-[280px] lg:pb-4">
            {panel === "page" && (
              <>
                <div>
                  <p className="font-bold">
                    {targets.size > 1 ? fill(t.selectedCount, { count: targets.size }) : fill(t.pageOf, { page: currentIndex + 1, count: pages.length })}
                  </p>
                  {current && targets.size <= 1 && (
                    <p className="mt-0.5 truncate text-xs text-muted">{fill(t.source, { file: current.file.name, page: current.index + 1 })}</p>
                  )}
                  <p className="mt-2 hidden text-xs text-muted lg:block">{t.selectHint}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => rotatePages(-90)} disabled={targets.size === 0} className={panelButton}>
                    <RotateCcw className="h-4 w-4" />
                    {t.rotateLeft}
                  </button>
                  <button type="button" onClick={() => rotatePages(90)} disabled={targets.size === 0} className={panelButton}>
                    <RotateCw className="h-4 w-4" />
                    {t.rotateRight}
                  </button>
                  <button type="button" onClick={() => movePages(-1)} disabled={targets.size === 0 || targets.has(pages[0]?.id)} className={panelButton}>
                    <ArrowUp className="h-4 w-4" />
                    {t.moveEarlier}
                  </button>
                  <button type="button" onClick={() => movePages(1)} disabled={targets.size === 0 || targets.has(pages[pages.length - 1]?.id)} className={panelButton}>
                    <ArrowDown className="h-4 w-4" />
                    {t.moveLater}
                  </button>
                  <button type="button" onClick={duplicatePages} disabled={targets.size === 0} className={panelButton}>
                    <Copy className="h-4 w-4" />
                    {t.duplicate}
                  </button>
                  <button type="button" onClick={removePages} disabled={targets.size === 0} className="flex items-center gap-2 rounded-lg border border-error/30 px-3 py-2 text-sm font-semibold text-error hover:bg-error-soft disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                    {t.remove}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <button type="button" onClick={startOver} className="font-semibold text-muted hover:text-foreground sm:hidden">
                    {t.startOver}
                  </button>
                  <button type="button" onClick={() => rotatePages(90, true)} className="font-semibold text-accent-hover hover:underline">
                    {t.rotateAll}
                  </button>
                  <button type="button" onClick={() => setSelected(new Set(pages.map((p) => p.id)))} className="font-semibold text-accent-hover hover:underline">
                    {t.selectAll}
                  </button>
                </div>
                {current?.crop && (
                  <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
                    <p>{t.crop.applied}</p>
                    <button type="button" onClick={() => commit(pages.map((p) => (p.id === current.id ? { ...p, crop: null } : p)))} className="mt-1 font-semibold text-accent-hover hover:underline">
                      {t.crop.reset}
                    </button>
                  </div>
                )}
                {totalFields > 0 && (
                  <div className="rounded-lg border border-border-soft p-3 text-sm">
                    <p className="font-bold">{t.forms.title}</p>
                    <p className="mt-1 text-muted">{fill(t.forms.found, { count: totalFields })}</p>
                    <p className="mt-1 text-xs text-muted">{t.forms.note}</p>
                  </div>
                )}
                <div className="hidden lg:block">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.shortcutsTitle}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                    {t.shortcuts.map(([keys, action]) => (
                      <div key={keys} className="contents">
                        <dt>
                          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]">{keys}</kbd>
                        </dt>
                        <dd className="text-muted">{action}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </>
            )}

            {panel === "object" &&
              (selectedAnn ? (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.object.title}</p>
                    <p className="mt-1 font-bold">{annTypeLabel(selectedAnn)}</p>
                  </div>
                  {selectedAnn.type === "text" && (
                    <TextProps value={textStyle} onChange={applyTextStyle} t={t.textProps} pickerT={t.fontPicker} />
                  )}
                  {selectedAnn.type === "text" && (
                    <label className={label}>
                      {t.object.editText}
                      <textarea
                        value={selectedAnn.text}
                        rows={3}
                        onFocus={beginChange}
                        onChange={(e) => {
                          const text = e.target.value;
                          updateCurrent((p) => ({
                            ...p,
                            annotations: p.annotations.map((a) => (a.id === selectedAnn.id && a.type === "text" ? replaceText(a, text) : a)),
                          }));
                        }}
                        className={`${field} font-normal text-foreground`}
                      />
                    </label>
                  )}
                  {(selectedAnn.type === "rect" || selectedAnn.type === "ellipse" || selectedAnn.type === "ink") && (
                    <label className={label}>
                      {t.style.opacity} ({Math.round(selectedAnn.opacity * 100)}%)
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={selectedAnn.opacity}
                        onPointerDown={beginChange}
                        onChange={(e) => {
                          const opacity = Number(e.target.value);
                          updateCurrent((p) => ({ ...p, annotations: p.annotations.map((a) => (a.id === selectedAnn.id ? { ...a, opacity } : a)) as Annotation[] }));
                        }}
                      />
                    </label>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={duplicateAnn} className={panelButton}>
                      <Copy className="h-4 w-4" />
                      {t.object.duplicate}
                    </button>
                    <button type="button" onClick={deleteAnn} className="flex items-center gap-2 rounded-lg border border-error/30 px-3 py-2 text-sm font-semibold text-error hover:bg-error-soft">
                      <Trash2 className="h-4 w-4" />
                      {t.object.delete}
                    </button>
                    <button type="button" onClick={() => reorderAnn(true)} className={panelButton}>
                      <BringToFront className="h-4 w-4" />
                      {t.object.front}
                    </button>
                    <button type="button" onClick={() => reorderAnn(false)} className={panelButton}>
                      <SendToBack className="h-4 w-4" />
                      {t.object.back}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">{t.object.none}</p>
              ))}

            {panel === "document" && (
              <>
                <section className="flex flex-col gap-2">
                  <p className="font-bold">{t.document.properties}</p>
                  <p className="-mt-1 text-xs text-muted">{t.document.propertiesNote}</p>
                  {(["title", "author", "subject", "keywords"] as (keyof PdfMetadata)[]).map((fieldName) => (
                    <label key={fieldName} className={label}>
                      {t.document[fieldName]}
                      <input
                        value={docOptions.metadata[fieldName]}
                        placeholder={fieldName === "keywords" ? t.document.keywordsHint : undefined}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDocOptions((o) => ({ ...o, metadata: { ...o.metadata, [fieldName]: value } }));
                        }}
                        className={`${field} font-normal text-foreground`}
                      />
                    </label>
                  ))}
                  {metaInfo && (metaInfo.created || metaInfo.modified || metaInfo.producer || metaInfo.creator) && (
                    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      {metaInfo.created && (
                        <>
                          <dt className="text-muted">{t.document.created}</dt>
                          <dd>{metaInfo.created.toLocaleString()}</dd>
                        </>
                      )}
                      {metaInfo.modified && (
                        <>
                          <dt className="text-muted">{t.document.modified}</dt>
                          <dd>{metaInfo.modified.toLocaleString()}</dd>
                        </>
                      )}
                      {(metaInfo.creator || metaInfo.producer) && (
                        <>
                          <dt className="text-muted">{t.document.madeWith}</dt>
                          <dd className="break-words">{[...new Set([metaInfo.creator, metaInfo.producer].filter(Boolean))].join(" · ")}</dd>
                        </>
                      )}
                    </dl>
                  )}
                </section>

                <section className="flex flex-col gap-2 border-t border-border-soft pt-4">
                  <label className="flex items-center justify-between font-bold">
                    {t.document.watermark}
                    <input type="checkbox" checked={docOptions.watermark.enabled} onChange={(e) => setDocOptions((o) => ({ ...o, watermark: { ...o.watermark, enabled: e.target.checked } }))} className="h-4 w-4 accent-accent" />
                  </label>
                  {docOptions.watermark.enabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`${label} col-span-2`}>
                        {t.document.text}
                        <input value={docOptions.watermark.text} onChange={(e) => setDocOptions((o) => ({ ...o, watermark: { ...o.watermark, text: e.target.value } }))} className={`${field} font-normal text-foreground`} />
                      </label>
                      <label className={label}>
                        {t.document.size}
                        <input type="number" min={12} max={200} value={docOptions.watermark.size} onChange={(e) => setDocOptions((o) => ({ ...o, watermark: { ...o.watermark, size: Number(e.target.value) || 60 } }))} className={`${field} font-normal text-foreground`} />
                      </label>
                      <label className={label}>
                        {t.document.color}
                        <input type="color" value={docOptions.watermark.color} onChange={(e) => setDocOptions((o) => ({ ...o, watermark: { ...o.watermark, color: e.target.value } }))} className="h-8 w-full cursor-pointer rounded border border-border" />
                      </label>
                      <label className={`${label} col-span-2`}>
                        {t.document.opacity} ({Math.round(docOptions.watermark.opacity * 100)}%)
                        <input type="range" min={0.05} max={1} step={0.05} value={docOptions.watermark.opacity} onChange={(e) => setDocOptions((o) => ({ ...o, watermark: { ...o.watermark, opacity: Number(e.target.value) } }))} />
                      </label>
                    </div>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <label className="flex items-center justify-between font-bold">
                    {t.document.pageNumbers}
                    <input type="checkbox" checked={docOptions.pageNumbers.enabled} onChange={(e) => setDocOptions((o) => ({ ...o, pageNumbers: { ...o.pageNumbers, enabled: e.target.checked } }))} className="h-4 w-4 accent-accent" />
                  </label>
                  {docOptions.pageNumbers.enabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`${label} col-span-2`}>
                        {t.document.position}
                        <select value={docOptions.pageNumbers.position} onChange={(e) => setDocOptions((o) => ({ ...o, pageNumbers: { ...o.pageNumbers, position: e.target.value as PageNumberPosition } }))} className={`${field} font-normal text-foreground`}>
                          {Object.entries(t.document.positions).map(([value, name]) => (
                            <option key={value} value={value}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={`${label} col-span-2`}>
                        {t.document.format}
                        <select value={docOptions.pageNumbers.template} onChange={(e) => setDocOptions((o) => ({ ...o, pageNumbers: { ...o.pageNumbers, template: e.target.value } }))} className={`${field} font-normal text-foreground`}>
                          {t.document.templates.map((tpl) => (
                            <option key={tpl} value={tpl}>
                              {tpl.replace("{n}", "1").replace("{total}", String(pages.length))}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={label}>
                        {t.document.startAt}
                        <input type="number" min={0} value={docOptions.pageNumbers.start} onChange={(e) => setDocOptions((o) => ({ ...o, pageNumbers: { ...o.pageNumbers, start: Number(e.target.value) || 1 } }))} className={`${field} font-normal text-foreground`} />
                      </label>
                      <label className={label}>
                        {t.document.size}
                        <input type="number" min={6} max={36} value={docOptions.pageNumbers.size} onChange={(e) => setDocOptions((o) => ({ ...o, pageNumbers: { ...o.pageNumbers, size: Number(e.target.value) || 11 } }))} className={`${field} font-normal text-foreground`} />
                      </label>
                    </div>
                  )}
                </section>

                {(docOptions.watermark.enabled || docOptions.pageNumbers.enabled) && <p className="-mt-2 text-xs text-muted">{t.document.appliesOnSave}</p>}

                <section className="flex flex-col gap-2 border-t border-border-soft pt-4">
                  <p className="font-bold">{t.document.exportTitle}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={label}>
                      {t.document.exportScope}
                      <select value={exportScope} onChange={(e) => setExportScope(e.target.value as typeof exportScope)} className={`${field} font-normal text-foreground`}>
                        <option value="current">{t.document.scopeCurrent}</option>
                        <option value="selected">{t.document.scopeSelected}</option>
                        <option value="all">{t.document.scopeAll}</option>
                      </select>
                    </label>
                    <label className={label}>
                      {t.document.exportFormat}
                      <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)} className={`${field} font-normal text-foreground`}>
                        <option value="image/jpeg">JPG</option>
                        <option value="image/png">PNG</option>
                      </select>
                    </label>
                  </div>
                  <button type="button" onClick={() => void exportImages()} disabled={exporting} className={`${panelButton} justify-center`}>
                    {exporting ? t.document.exporting : t.document.exportButton}
                  </button>
                </section>
              </>
            )}

            {downloaded && <SupportNote t={support} />}
          </div>
        </aside>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pickImage(file);
          else setTool("select");
        }}
      />

      {organizerOpen && (
        <PageOrganizer
          t={t}
          pages={pages}
          imageFor={(page) => thumbs[sourceKey(page)] || previews[sourceKey(page)] || undefined}
          currentId={currentId}
          selected={selected}
          onSelectedChange={setSelected}
          onOpen={openPage}
          onReorder={reorderPages}
          onRotate={(by) => rotatePages(by)}
          onDuplicate={duplicatePages}
          onDelete={removePages}
          onAddFiles={(files) => void addFiles(files)}
          onClose={() => setOrganizerOpen(false)}
        />
      )}

      {signatureOpen && (
        <SignatureDialog
          t={t.signature}
          recent={signatures}
          onUse={useSignature}
          onClose={() => {
            setSignatureOpen(false);
            if (!pendingImage) setTool("select");
          }}
        />
      )}
    </div>
  );
}
