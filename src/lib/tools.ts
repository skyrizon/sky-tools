import { QrCode, ImageIcon, type LucideIcon } from "lucide-react";

export type ToolCategory = "qr" | "image" | "pdf";

export type Tool = {
  slug: string;
  name: string;
  description: string;
  /** Keyword-led page title for search results; the site name is appended by the layout. */
  seoTitle: string;
  category: ToolCategory;
  icon: LucideIcon;
};

/**
 * Central registry of every tool on the site. Add an entry here and a matching
 * route at `src/app/tools/<slug>/page.tsx` to ship a new tool — the homepage,
 * navigation, sitemap, and related-tools links pick it up automatically.
 */
export const TOOLS: Tool[] = [
  {
    slug: "qr-generator",
    name: "QR Code Generator",
    description: "Turn text, links, or WiFi credentials into a QR code — with an optional logo.",
    seoTitle: "Free QR Code Generator — WiFi, Links & Logo",
    category: "qr",
    icon: QrCode,
  },
  {
    slug: "image-converter",
    name: "Image Converter",
    description: "Convert images between JPG, PNG, and WebP, or turn a PDF into images — right in your browser.",
    seoTitle: "Image Converter — JPG, PNG, WebP & PDF to Image",
    category: "image",
    icon: ImageIcon,
  },
];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

/** Other tools to link from a tool page: same category first, then the rest. */
export function relatedTools(slug: string, limit = 3): Tool[] {
  const current = getTool(slug);
  const others = TOOLS.filter((tool) => tool.slug !== slug);
  return [
    ...others.filter((tool) => tool.category === current?.category),
    ...others.filter((tool) => tool.category !== current?.category),
  ].slice(0, limit);
}
