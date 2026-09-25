"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { hasRealItalic } from "@/lib/pdf-studio/fonts";
import { styledRuns, type RunStyle } from "@/lib/pdf-studio/rich-text";
import type { TextAnnotation } from "@/lib/pdf-studio/types";

const styleKey = (s: RunStyle) => `${s.bold ? "b" : ""}${s.italic ? "i" : ""}${s.underline ? "u" : ""}${s.color.toLowerCase()}`;

// The editable area holds one <span> per run of formatting, plus a trailing
// <br data-end> so a final empty line stays visible. Offsets count characters
// of the text, with any other <br> (inserted by the browser) as a newline.

function textOf(root: Node): string {
  let text = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue ?? "";
    else if (node.nodeName === "BR") {
      if (!(node as HTMLElement).hasAttribute("data-end")) text += "\n";
    } else node.childNodes.forEach(walk);
  };
  walk(root);
  return text;
}

/** Formatting key of every character currently in the editor, to spot when it's out of date. */
function domStyleKeys(root: HTMLElement): string[] {
  const keys: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const key = node.parentElement?.dataset.k ?? "";
      for (let i = 0; i < (node.nodeValue ?? "").length; i++) keys.push(key);
    } else if (node.nodeName === "BR") {
      if (!(node as HTMLElement).hasAttribute("data-end")) keys.push("");
    } else node.childNodes.forEach(walk);
  };
  walk(root);
  return keys;
}

function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return textOf(range.cloneContents()).length;
}

function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const a = offsetOf(root, range.startContainer, range.startOffset);
  const b = offsetOf(root, range.endContainer, range.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** The DOM position of a character offset. */
function locate(root: HTMLElement, target: number): { node: Node; offset: number } {
  let remaining = target;
  let found: { node: Node; offset: number } | null = null;
  const walk = (node: Node) => {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const length = (node.nodeValue ?? "").length;
      if (remaining <= length) found = { node, offset: remaining };
      else remaining -= length;
    } else if (node.nodeName === "BR") {
      if ((node as HTMLElement).hasAttribute("data-end")) return;
      const index = Array.prototype.indexOf.call(node.parentNode!.childNodes, node);
      if (remaining === 0) found = { node: node.parentNode!, offset: index };
      else remaining -= 1;
    } else node.childNodes.forEach(walk);
  };
  walk(root);
  return found ?? { node: root, offset: Math.max(0, root.childNodes.length - 1) };
}

function setSelectionOffsets(root: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const a = locate(root, start);
  const b = locate(root, end);
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

function render(root: HTMLElement, ann: TextAnnotation) {
  const spans = styledRuns(ann).map((run) => {
    const span = document.createElement("span");
    span.dataset.k = styleKey(run.style);
    span.textContent = run.text;
    span.style.fontWeight = run.style.bold ? "700" : "400";
    // Fonts without an italic face are slanted by the browser, close to the saved slant.
    span.style.fontStyle = run.style.italic ? "italic" : "normal";
    if (run.style.italic && !hasRealItalic(ann.font, run.style.bold)) span.style.fontSynthesis = "style";
    span.style.textDecoration = run.style.underline ? "underline" : "none";
    span.style.color = run.style.color;
    return span;
  });
  const end = document.createElement("br");
  end.setAttribute("data-end", "");
  root.replaceChildren(...spans, end);
}

/**
 * Edits a text object in place, showing its mixed formatting. Typing keeps
 * each character's formatting; the selection is reported so formatting can
 * be applied to just the selected characters.
 */
export default function RichTextEditor({
  ann,
  style,
  onTextChange,
  onSelectionChange,
  onToggle,
  onDone,
}: {
  ann: TextAnnotation;
  style: React.CSSProperties;
  onTextChange: (text: string) => void;
  onSelectionChange: (start: number, end: number) => void;
  onToggle: (prop: "bold" | "italic" | "underline") => void;
  /** `keepSelection`: focus moved to a formatting control, which should act on the selection. */
  onDone: (keepSelection: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  // Brings the editor in line with the object (after typing, or formatting applied from outside).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || composing.current) return;
    const modelKeys = styledRuns(ann).flatMap((run) => Array.from({ length: run.text.length }, () => styleKey(run.style)));
    const upToDate =
      textOf(el) === ann.text && el.lastChild?.nodeName === "BR" && domStyleKeys(el).join("|") === modelKeys.join("|");
    const focused = document.activeElement === el;
    const selection = pendingSelection.current ?? (focused ? getSelectionOffsets(el) : null);
    pendingSelection.current = null;
    if (upToDate) return;
    render(el, ann);
    if (selection) setSelectionOffsets(el, selection.start, selection.end);
  });

  // Starts with everything selected, like a new text box.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    setSelectionOffsets(el, 0, ann.text.length);
    onSelectionChange(0, ann.text.length);
    // Only on opening the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onChange() {
      const el = ref.current;
      if (!el || document.activeElement !== el) return;
      const sel = getSelectionOffsets(el);
      if (sel) onSelectionChange(sel.start, sel.end);
    }
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [onSelectionChange]);

  /** Replaces the selection with plain text (Enter, paste), keeping our own markup. */
  function insert(text: string) {
    const el = ref.current;
    if (!el) return;
    const sel = getSelectionOffsets(el) ?? { start: ann.text.length, end: ann.text.length };
    pendingSelection.current = { start: sel.start + text.length, end: sel.start + text.length };
    onTextChange(ann.text.slice(0, sel.start) + text + ann.text.slice(sel.end));
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      spellCheck={false}
      className="absolute rounded-sm bg-white/70 p-0 outline outline-1 outline-accent"
      style={{ ...style, whiteSpace: "pre", cursor: "text" }}
      onInput={() => {
        if (composing.current || !ref.current) return;
        onTextChange(textOf(ref.current));
      }}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
        if (ref.current) onTextChange(textOf(ref.current));
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        const mod = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        if (e.key === "Escape") e.currentTarget.blur();
        else if (e.key === "Enter" && !composing.current) {
          e.preventDefault();
          insert("\n");
        } else if (mod && (key === "b" || key === "i" || key === "u")) {
          e.preventDefault();
          onToggle(key === "b" ? "bold" : key === "i" ? "italic" : "underline");
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        insert(e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n"));
      }}
      onDrop={(e) => e.preventDefault()}
      onBlur={(e) => {
        const next = e.relatedTarget as Element | null;
        onDone(!!next?.closest("[data-text-format]"));
      }}
    />
  );
}
