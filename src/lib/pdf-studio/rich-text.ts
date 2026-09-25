/**
 * Mixed formatting inside one text object. The object's own bold/italic/
 * underline/color are the defaults; `spans` override them for ranges of `text`
 * (character offsets, end exclusive), so part of a line can be bold.
 */

import type { TextAnnotation, TextSpan } from "./types";

export type RunStyle = { bold: boolean; italic: boolean; underline: boolean; color: string };
export type RunPatch = Partial<RunStyle>;

export const RUN_KEYS = ["bold", "italic", "underline", "color"] as const;

/** A stretch of text with one style. `start` is its offset in the object's text. */
export type StyledRun = { text: string; start: number; style: RunStyle };

export function baseStyle(ann: TextAnnotation): RunStyle {
  return { bold: ann.bold, italic: !!ann.italic, underline: !!ann.underline, color: ann.color };
}

/** The style of every character. */
function charStyles(ann: TextAnnotation): RunStyle[] {
  const base = baseStyle(ann);
  const styles = Array.from({ length: ann.text.length }, () => base);
  for (const span of ann.spans ?? []) {
    const { start, end, ...patch } = span;
    for (let i = Math.max(0, start); i < Math.min(end, styles.length); i++) styles[i] = { ...styles[i], ...patch };
  }
  return styles;
}

const sameStyle = (a: RunStyle, b: RunStyle) =>
  a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.color.toLowerCase() === b.color.toLowerCase();

/** Compresses per-character styles back into spans that differ from the object's defaults. */
function toSpans(ann: TextAnnotation, styles: RunStyle[]): TextSpan[] | undefined {
  const base = baseStyle(ann);
  const spans: TextSpan[] = [];
  styles.forEach((style, i) => {
    const diff: RunPatch = {};
    for (const key of RUN_KEYS) {
      if (key === "color" ? style.color.toLowerCase() !== base.color.toLowerCase() : style[key] !== base[key]) {
        (diff as Record<string, unknown>)[key] = style[key];
      }
    }
    if (Object.keys(diff).length === 0) return;
    const last = spans[spans.length - 1];
    if (last && last.end === i && RUN_KEYS.every((key) => last[key] === diff[key])) last.end = i + 1;
    else spans.push({ start: i, end: i + 1, ...diff });
  });
  return spans.length ? spans : undefined;
}

/** The text as runs of one style each (newlines included). */
export function styledRuns(ann: TextAnnotation): StyledRun[] {
  const styles = charStyles(ann);
  const runs: StyledRun[] = [];
  for (let i = 0; i < ann.text.length; i++) {
    const last = runs[runs.length - 1];
    if (last && sameStyle(last.style, styles[i])) last.text += ann.text[i];
    else runs.push({ text: ann.text[i], start: i, style: styles[i] });
  }
  return runs;
}

/** Runs split into lines; an empty line is an empty array. */
export function styledLines(ann: TextAnnotation): StyledRun[][] {
  const lines: StyledRun[][] = [[]];
  for (const run of styledRuns(ann)) {
    const parts = run.text.split("\n");
    let offset = run.start;
    parts.forEach((part, i) => {
      if (i > 0) {
        lines.push([]);
        offset += 1;
      }
      if (part) lines[lines.length - 1].push({ text: part, start: offset, style: run.style });
      offset += part.length;
    });
  }
  return lines;
}

/**
 * Applies formatting to characters start..end. An empty range, or one covering
 * all the text, changes the whole object instead.
 */
export function applyRunStyle(ann: TextAnnotation, start: number, end: number, changes: RunPatch): TextAnnotation {
  // Only the properties actually given; an undefined value must not overwrite one.
  const patch: RunPatch = {};
  for (const key of RUN_KEYS) if (changes[key] !== undefined) Object.assign(patch, { [key]: changes[key] });
  if (Object.keys(patch).length === 0) return ann;
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(ann.text.length, Math.max(start, end));
  const styles = charStyles(ann);
  if (from >= to || (from === 0 && to === ann.text.length)) {
    const next = { ...ann, ...patch };
    // Keep the other properties' ranges; the patched ones now come from the defaults.
    const kept = styles.map((style) => ({ ...style, ...patch }));
    return { ...next, spans: toSpans(next, kept) };
  }
  for (let i = from; i < to; i++) styles[i] = { ...styles[i], ...patch };
  return { ...ann, spans: toSpans(ann, styles) };
}

/**
 * The formatting shown for a selection: bold/italic/underline only when every
 * selected character has it, and the first character's color.
 */
export function rangeStyle(ann: TextAnnotation, start: number, end: number): RunStyle {
  const styles = charStyles(ann).slice(Math.min(start, end), Math.max(start, end));
  if (styles.length === 0) return baseStyle(ann);
  return {
    bold: styles.every((s) => s.bold),
    italic: styles.every((s) => s.italic),
    underline: styles.every((s) => s.underline),
    color: styles[0].color,
  };
}

/**
 * New text for an object, keeping each character's formatting: typed
 * characters take the style of the character before them.
 */
export function replaceText(ann: TextAnnotation, text: string): TextAnnotation {
  if (text === ann.text) return ann;
  if (!ann.spans?.length) return { ...ann, text };
  const old = ann.text;
  let prefix = 0;
  while (prefix < old.length && prefix < text.length && old[prefix] === text[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < old.length - prefix &&
    suffix < text.length - prefix &&
    old[old.length - 1 - suffix] === text[text.length - 1 - suffix]
  ) {
    suffix++;
  }
  const styles = charStyles(ann);
  const inherit = styles[prefix - 1] ?? styles[prefix] ?? baseStyle(ann);
  const inserted = Array.from({ length: text.length - prefix - suffix }, () => inherit);
  const next = { ...ann, text };
  return { ...next, spans: toSpans(next, [...styles.slice(0, prefix), ...inserted, ...styles.slice(old.length - suffix)]) };
}
