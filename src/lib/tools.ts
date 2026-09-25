import {
  Combine,
  FileImage,
  ImageDown,
  ImageIcon,
  QrCode,
  ScanQrCode,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/dictionaries";

export type ToolSlug = keyof Dictionary["tools"];
export type ToolCategory = "qr" | "image" | "pdf";

export type Tool = {
  slug: ToolSlug;
  category: ToolCategory;
  icon: LucideIcon;
};

/**
 * Central registry of every tool on the site. Add an entry here, its text under
 * `tools` in both dictionaries (`src/dictionaries/`), and a route at
 * `src/app/[lang]/tools/<slug>/page.tsx` to ship a new tool — the homepage,
 * sitemap, and related-tools links pick it up automatically.
 */
export const TOOLS: Tool[] = [
  { slug: "qr-generator", category: "qr", icon: QrCode },
  { slug: "image-converter", category: "image", icon: ImageIcon },
  { slug: "image-compressor", category: "image", icon: ImageDown },
  { slug: "images-to-pdf", category: "pdf", icon: FileImage },
  { slug: "pdf-merge", category: "pdf", icon: Combine },
  { slug: "pdf-split", category: "pdf", icon: Scissors },
  { slug: "qr-scanner", category: "qr", icon: ScanQrCode },
];

export function isToolSlug(value: string): value is ToolSlug {
  return TOOLS.some((tool) => tool.slug === value);
}

export function getTool(slug: ToolSlug): Tool {
  return TOOLS.find((tool) => tool.slug === slug)!;
}

/** Other tools to link from a tool page: same category first, then the rest. */
export function relatedTools(slug: ToolSlug, limit = 3): Tool[] {
  const current = getTool(slug);
  const others = TOOLS.filter((tool) => tool.slug !== slug);
  return [
    ...others.filter((tool) => tool.category === current.category),
    ...others.filter((tool) => tool.category !== current.category),
  ].slice(0, limit);
}
