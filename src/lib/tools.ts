import { QrCode, ImageIcon, type LucideIcon } from "lucide-react";

export type Tool = {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
};

/**
 * Central registry of every tool on the site. Add an entry here and a matching
 * route at `src/app/tools/<slug>/page.tsx` to ship a new tool — the homepage
 * and navigation pick it up automatically.
 */
export const TOOLS: Tool[] = [
  {
    slug: "qr-generator",
    name: "QR Code Generator",
    description: "Turn text, links, or WiFi credentials into a QR code — with an optional logo.",
    icon: QrCode,
  },
  {
    slug: "image-converter",
    name: "Image Converter",
    description: "Convert images between JPG, PNG, and WebP, or turn a PDF into images — right in your browser.",
    icon: ImageIcon,
  },
];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}
