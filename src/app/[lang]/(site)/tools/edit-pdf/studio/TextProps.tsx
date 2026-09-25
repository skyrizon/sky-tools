"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Minus, Plus, Underline } from "lucide-react";
import type { Dictionary } from "@/dictionaries";
import type { StudioFontId } from "@/lib/pdf-studio/fonts";
import { DEFAULT_LINE_HEIGHT } from "@/lib/pdf-studio/types";
import FontPicker from "./FontPicker";

export type TextStyle = {
  font: StudioFontId;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
  lineHeight: number;
  color: string;
};

const LINE_HEIGHTS = [1, 1.15, 1.3, 1.5, 2];
const COLORS = ["#10151c", "#5b6672", "#dc2626", "#ea580c", "#16a34a", "#1786f9", "#1e3a8a", "#7c3aed"];

/**
 * Text formatting controls: font, size, bold/italic/underline, alignment, and
 * (in the full layout) line spacing and color. `compact` fits the toolbar.
 */
export default function TextProps({
  value,
  onChange,
  t,
  pickerT,
  compact = false,
}: {
  value: TextStyle;
  onChange: (patch: Partial<TextStyle>) => void;
  t: Dictionary["editPdf"]["ui"]["textProps"];
  pickerT: Dictionary["editPdf"]["ui"]["fontPicker"];
  compact?: boolean;
}) {
  const setSize = (size: number) => onChange({ size: Math.min(400, Math.max(4, Math.round(size * 2) / 2)) });
  const toggle = (active: boolean) =>
    `rounded-md p-1.5 ${active ? "bg-accent-soft text-accent-hover" : "text-muted hover:bg-background hover:text-foreground"}`;
  const field = "rounded-lg border border-border bg-background-raised px-2 py-1.5 text-sm focus:border-accent focus:outline-none";

  const fontSelect = <FontPicker value={value.font} onChange={(font) => onChange({ font })} t={pickerT} compact={compact} />;

  const sizeControl = (
    <div className="flex items-center rounded-lg border border-border bg-background-raised" title={t.size}>
      <button type="button" onClick={() => setSize(value.size - 1)} aria-label={t.smaller} className="px-1.5 py-1.5 text-muted hover:text-foreground">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        min={4}
        max={400}
        step={0.5}
        value={Math.round(value.size * 10) / 10}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n > 0) setSize(n);
        }}
        aria-label={t.size}
        className="w-12 bg-transparent py-1.5 text-center text-sm [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => setSize(value.size + 1)} aria-label={t.larger} className="px-1.5 py-1.5 text-muted hover:text-foreground">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const styleButtons = (
    <div className="flex items-center gap-0.5">
      <button type="button" aria-pressed={value.bold} aria-label={t.bold} title={`${t.bold} (Ctrl+B)`} onClick={() => onChange({ bold: !value.bold })} className={toggle(value.bold)}>
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" aria-pressed={value.italic} aria-label={t.italic} title={`${t.italic} (Ctrl+I)`} onClick={() => onChange({ italic: !value.italic })} className={toggle(value.italic)}>
        <Italic className="h-4 w-4" />
      </button>
      <button type="button" aria-pressed={value.underline} aria-label={t.underline} title={`${t.underline} (Ctrl+U)`} onClick={() => onChange({ underline: !value.underline })} className={toggle(value.underline)}>
        <Underline className="h-4 w-4" />
      </button>
    </div>
  );

  const alignButtons = (
    <div className="flex items-center gap-0.5" role="group" aria-label={t.align}>
      {(
        [
          ["left", AlignLeft, t.alignLeft],
          ["center", AlignCenter, t.alignCenter],
          ["right", AlignRight, t.alignRight],
        ] as const
      ).map(([align, Icon, label]) => (
        <button key={align} type="button" aria-pressed={value.align === align} aria-label={label} title={label} onClick={() => onChange({ align })} className={toggle(value.align === align)}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {fontSelect}
        {sizeControl}
        {styleButtons}
        {alignButtons}
      </div>
    );
  }

  const label = "flex flex-col gap-1 text-xs font-semibold text-muted";
  return (
    <div className="flex flex-col gap-3">
      <label className={label}>
        {t.font}
        {fontSelect}
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div className={label}>
          {t.size}
          {sizeControl}
        </div>
        <label className={label}>
          {t.lineSpacing}
          <select
            value={value.lineHeight}
            onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
            className={field}
          >
            {[...new Set([...LINE_HEIGHTS, value.lineHeight ?? DEFAULT_LINE_HEIGHT])]
              .sort((a, b) => a - b)
              .map((lh) => (
                <option key={lh} value={lh}>
                  {lh.toFixed(2).replace(/0$/, "")}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {styleButtons}
        <span className="h-5 w-px bg-border" />
        {alignButtons}
      </div>
      <div className={label}>
        {t.color}
        <div className="flex flex-wrap items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onChange({ color: c })}
              className={`h-6 w-6 rounded-full border ${value.color.toLowerCase() === c ? "ring-2 ring-accent ring-offset-1" : "border-border"}`}
              style={{ background: c }}
            />
          ))}
          <input type="color" value={value.color} onChange={(e) => onChange({ color: e.target.value })} aria-label={t.color} className="h-7 w-8 cursor-pointer rounded border border-border bg-transparent" />
        </div>
      </div>
    </div>
  );
}
