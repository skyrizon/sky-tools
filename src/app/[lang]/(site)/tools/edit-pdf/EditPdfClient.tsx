"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  BringToFront,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Crop,
  Eraser,
  FileText,
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
import { getPdfPageSizes, releasePdf, renderPdfPageToImage } from "@/lib/pdf-convert";
import { PdfToolError, pdfPageCount } from "@/lib/pdf-tools";
import { exportStudioPdf } from "@/lib/pdf-studio/export";
import { readFormFields } from "@/lib/pdf-studio/forms";
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
import AnnotationShapes from "./studio/AnnotationShapes";
import PageEditor, { type PendingImage, type StyleState } from "./studio/PageEditor";
import SignatureDialog, { type SignatureImage } from "./studio/SignatureDialog";

type T = Dictionary["editPdf"]["ui"];
type FileForms = { widgets: FormWidget[]; values: Record<string, FormValue> };

const sourceKey = (page: StudioPage) => `${page.file.name}|${page.file.lastModified}|${page.file.size}|${page.index}`;
const HISTORY_LIMIT = 60;
const COLORS = ["#10151c", "#dc2626", "#ea580c", "#16a34a", "#1786f9", "#7c3aed", "#db2777", "#ffffff"];
const WIDTHS = [1, 2, 3, 5, 8];
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 24, 32, 48, 72];
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((z) => z * (96 / 72));
const newId = () => Math.random().toString(36).slice(2, 10);

const TOOLS: { tool: Tool; icon: LucideIcon; key?: string }[] = [
  { tool: "select", icon: MousePointer2, key: "v" },
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
  const [docOptions, setDocOptions] = useState<DocOptions>({
    watermark: { enabled: false, text: t.document.watermarkDefault, size: 60, color: "#dc2626", opacity: 0.2 },
    pageNumbers: { enabled: false, position: "bottom-center", template: t.document.templates[0], start: 1, size: 11 },
  });

  // ----- view state -----
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [style, setStyle] = useState<StyleState>({ color: "#10151c", fill: null, strokeWidth: 2, fontSize: 16, bold: false });
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [panel, setPanel] = useState<"page" | "object" | "document">("page");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signatures, setSignatures] = useState<SignatureImage[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);
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
  const railRef = useRef<HTMLOListElement>(null);
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
    railRef.current?.querySelector(`[data-page-id="${currentId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentId]);

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

  const scrollToPage = useCallback((id: number) => {
    scrollRef.current
      ?.querySelector(`[data-canvas-page="${id}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  // Selecting an object opens its panel.
  const selectAnn = useCallback((id: string | null) => {
    setSelectedAnnId(id);
    if (id) setPanel("object");
  }, []);

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
    setFiles((prev) => [...prev, ...newFiles]);
    setForms(newForms);
    commit([...pages, ...added]);
    if (currentId === null) {
      setCurrentId(added[0].id);
      setSelected(new Set([added[0].id]));
    }
  }

  // ----- page actions -----
  function selectPage(event: React.MouseEvent, page: StudioPage, index: number) {
    if (event.shiftKey) {
      const [from, to] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
      setSelected(new Set(pages.slice(from, to + 1).map((p) => p.id)));
    } else if (event.ctrlKey || event.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(page.id)) next.delete(page.id);
        else next.add(page.id);
        return next;
      });
      anchor.current = index;
    } else {
      setSelected(new Set([page.id]));
      anchor.current = index;
    }
    setCurrentId(page.id);
    setSelectedAnnId(null);
    scrollToPage(page.id);
  }

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

  function dropOn(index: number) {
    if (dragFrom === null || dragFrom === index) return;
    const next = [...pages];
    const [moved] = next.splice(dragFrom, 1);
    next.splice(index, 0, moved);
    commit(next);
    setDragFrom(null);
  }

  // ----- annotation actions -----
  const deleteAnn = useCallback(() => {
    if (!selectedAnnId) return;
    beginChange();
    updateCurrent((p) => ({ ...p, annotations: p.annotations.filter((a) => a.id !== selectedAnnId) }));
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
  function applyStyle(patch: Partial<StyleState>) {
    setStyle((s) => ({ ...s, ...patch }));
    if (!selectedAnn || tool !== "select") return;
    updateSelectedAnn((a) => {
      if (a.type === "text")
        return { ...a, color: patch.color ?? a.color, size: patch.fontSize ?? a.size, bold: patch.bold ?? a.bold };
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
  }

  function chooseTool(next: Tool) {
    setEditingId(null);
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
      if (signatureOpen) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const nudge = event.shiftKey ? 10 : 1;
      if (mod && key === "z" && !event.shiftKey) undo();
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
      else if (!mod && TOOLS.some((x) => x.key === key)) chooseTool(TOOLS.find((x) => x.key === key)!.tool);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages, currentIndex, selectedAnnId, signatureOpen, undo, redo, save, goTo, rotatePages, removePages, deleteAnn, updateSelectedAnn]);

  // ----- render -----
  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <FileDropZone title={t.dropTitle} hint={t.dropHint} accept="application/pdf,.pdf" onFiles={addFiles} />
          {error && <p className="mt-4 rounded-lg bg-error-soft px-4 py-3 text-sm font-semibold text-error">{error}</p>}
        </div>
      </div>
    );
  }

  const iconButton =
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-muted hover:bg-background hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  const panelButton =
    "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent-hover disabled:opacity-40 disabled:hover:border-border disabled:hover:text-inherit";
  const field = "rounded-lg border border-border bg-background-raised px-2 py-1.5 text-sm focus:border-accent focus:outline-none";
  const label = "flex flex-col gap-1 text-xs font-semibold text-muted";

  // What the style bar edits: the selected object, or the active drawing tool.
  const styleTarget: string | null =
    tool === "select" && selectedAnn
      ? selectedAnn.type === "rect" || selectedAnn.type === "ellipse"
        ? selectedAnn.role ?? selectedAnn.type
        : selectedAnn.type
      : tool;
  const showColor = !["select", "crop", "image", "signature", "whiteout", "highlighter"].includes(styleTarget ?? "") && styleTarget !== "image";
  const showWidth = ["pen", "highlighter", "rect", "ellipse", "line", "arrow", "ink"].includes(styleTarget ?? "");
  const showFont = styleTarget === "text";
  const showFill = styleTarget === "rect" || styleTarget === "ellipse";
  const activeColor =
    tool === "select" && selectedAnn
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

  const annTypeLabel = (a: Annotation) =>
    a.type === "image"
      ? t.object.types[a.kind]
      : a.type === "line"
        ? t.object.types[a.arrow ? "arrow" : "line"]
        : (a.type === "rect" || a.type === "ellipse") && a.role
          ? t.object.types[a.role]
          : t.object.types[a.type];

  return (
    <div className="flex flex-1 flex-col bg-background-raised lg:min-h-0">
      {/* Main toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5 sm:px-3">
        <span className="mr-1 flex min-w-0 items-center gap-2 px-1 text-sm font-semibold">
          <FileText className="h-4 w-4 shrink-0 text-accent-hover" />
          <span className="max-w-[10rem] truncate">{files[0].name}</span>
          <span className="shrink-0 font-normal text-muted">· {fill(t.pageCount, { count: pages.length })}</span>
        </span>
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
        <button type="button" onClick={() => setZoom((z) => ZOOMS.filter((v) => v < (z === "fit" ? ZOOMS[2] : z)).pop() ?? ZOOMS[0])} aria-label={t.zoomOut} title={t.zoomOut} className={iconButton}>
          <ZoomOut className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setZoom("fit")} title={t.zoomFit} className={`${iconButton} ${zoom === "fit" ? "text-accent-hover" : ""}`}>
          <Maximize className="h-4 w-4" />
          <span className="hidden sm:inline">{zoom === "fit" ? t.zoomFit : `${Math.round((zoom / (96 / 72)) * 100)}%`}</span>
        </button>
        <button type="button" onClick={() => setZoom((z) => ZOOMS.find((v) => v > (z === "fit" ? ZOOMS[2] - 0.01 : z)) ?? ZOOMS[ZOOMS.length - 1])} aria-label={t.zoomIn} title={t.zoomIn} className={iconButton}>
          <ZoomIn className="h-4 w-4" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={startOver} className={iconButton}>
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
        </div>
      </div>

      {/* Tool palette + style bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-2 py-1.5 sm:px-3">
        <div className="flex flex-wrap items-center gap-0.5" role="toolbar">
          {TOOLS.map(({ tool: value, icon: Icon, key }) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseTool(value)}
              aria-pressed={tool === value}
              title={`${t.tools[value]}${key ? ` (${key.toUpperCase()})` : ""}`}
              aria-label={t.tools[value]}
              className={`rounded-lg p-2 ${tool === value ? "bg-accent text-white shadow-sm" : "text-muted hover:bg-background hover:text-foreground"}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {(showColor || showWidth || showFont || showFill) && <span className="h-6 w-px bg-border" />}

        {showColor && (
          <div className="flex items-center gap-1" aria-label={t.style.color}>
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
          <label className="flex items-center gap-1 text-xs font-semibold text-muted">
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
        {showFont && (
          <>
            <label className="flex items-center gap-1 text-xs font-semibold text-muted">
              {t.style.fontSize}
              <select
                value={selectedAnn?.type === "text" && tool === "select" ? Math.round(selectedAnn.size) : style.fontSize}
                onChange={(e) => applyStyle({ fontSize: Number(e.target.value) })}
                className={field}
              >
                {[...new Set([...FONT_SIZES, selectedAnn?.type === "text" ? Math.round(selectedAnn.size) : style.fontSize])]
                  .sort((a, b) => a - b)
                  .map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              aria-label={t.style.bold}
              aria-pressed={selectedAnn?.type === "text" && tool === "select" ? selectedAnn.bold : style.bold}
              onClick={() => applyStyle({ bold: !(selectedAnn?.type === "text" && tool === "select" ? selectedAnn.bold : style.bold) })}
              className={`rounded-lg p-1.5 ${(selectedAnn?.type === "text" && tool === "select" ? selectedAnn.bold : style.bold) ? "bg-accent-soft text-accent-hover" : "text-muted hover:bg-background"}`}
            >
              <Bold className="h-4 w-4" />
            </button>
          </>
        )}
        {showFill && (
          <div className="flex items-center gap-1 text-xs font-semibold text-muted">
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

      {error && <p className="border-b border-border bg-error-soft px-4 py-2 text-sm font-semibold text-error">{error}</p>}

      <div className="grid grid-cols-1 lg:min-h-0 lg:flex-1 lg:grid-cols-[168px_minmax(0,1fr)_280px]">
        {/* Page rail */}
        <aside className="order-2 border-t border-border lg:order-none lg:overflow-y-auto lg:border-r lg:border-t-0">
          <p className="hidden px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted lg:block">{t.pages}</p>
          <ol ref={railRef} className="flex gap-3 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
            {pages.map((page, i) => {
              const thumb = thumbs[sourceKey(page)];
              const isSelected = selected.has(page.id);
              const isCurrent = page.id === current?.id;
              const wide = page.size.w >= page.size.h;
              return (
                <li
                  key={page.id}
                  data-page-id={page.id}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropOn(i);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                  className="shrink-0"
                >
                  <button
                    type="button"
                    onClick={(e) => selectPage(e, page, i)}
                    aria-label={fill(t.pageLabel, { page: i + 1 })}
                    aria-pressed={isSelected}
                    className={`flex w-24 flex-col items-center gap-1.5 rounded-xl border-2 p-1.5 transition lg:w-full ${dragFrom === i ? "opacity-40" : ""} ${
                      isSelected ? "border-accent bg-accent-soft" : "border-transparent hover:border-border hover:bg-background"
                    }`}
                  >
                    <span className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md bg-background">
                      <span
                        className="relative bg-white shadow-sm transition-transform"
                        style={{
                          aspectRatio: `${page.size.w} / ${page.size.h}`,
                          width: wide ? "88%" : "auto",
                          height: wide ? "auto" : "88%",
                          transform: `rotate(${page.rotation}deg)`,
                        }}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
                        ) : (
                          <span className="absolute inset-0 animate-pulse bg-border-soft" />
                        )}
                        {page.annotations.length > 0 && (
                          <svg viewBox={`0 0 ${page.size.w} ${page.size.h}`} className="absolute inset-0 h-full w-full">
                            <AnnotationShapes annotations={page.annotations} />
                          </svg>
                        )}
                      </span>
                    </span>
                    <span className={`text-xs font-semibold ${isCurrent ? "text-accent-hover" : "text-muted"}`}>{i + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Canvas: all pages in one scrolling column */}
        <section className="relative order-1 h-[70vh] min-h-[380px] bg-background lg:order-none lg:h-auto">
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
                    <div key={page.id} data-canvas-page={page.id} className="flex scroll-mt-10 flex-col items-center gap-2">
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
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {current && (
            <>
              <p className="pointer-events-none absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 truncate rounded-full bg-foreground/80 px-3 py-1 text-xs font-medium text-white">
                {t.hints[tool]}
              </p>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground/80 px-1.5 py-1 text-xs font-semibold text-white">
                <button type="button" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} aria-label={t.previous} className="rounded-full p-1 hover:bg-white/15 disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-1">{fill(t.pageOf, { page: currentIndex + 1, count: pages.length })}</span>
                <button type="button" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex >= pages.length - 1} aria-label={t.next} className="rounded-full p-1 hover:bg-white/15 disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </section>

        {/* Inspector */}
        <aside className="order-3 flex flex-col border-t border-border lg:order-none lg:min-h-0 lg:border-l lg:border-t-0">
          <div className="flex border-b border-border" role="tablist">
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

          <div className="flex flex-col gap-5 p-4 lg:overflow-y-auto">
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
                    <label className={label}>
                      {t.object.editText}
                      <textarea
                        value={selectedAnn.text}
                        rows={3}
                        onFocus={beginChange}
                        onChange={(e) => {
                          const text = e.target.value;
                          updateCurrent((p) => ({ ...p, annotations: p.annotations.map((a) => (a.id === selectedAnn.id ? { ...a, text } : a)) as Annotation[] }));
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
