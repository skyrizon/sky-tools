import type { ImageOutputFormat } from "@/lib/image-convert";

/**
 * Format-specific landing pages (/convert/png-to-jpg, ...). Each one is the
 * Image Converter preset to one output format, with its own text in the
 * dictionaries under `conversions`.
 */
export const CONVERSIONS = [
  { slug: "png-to-jpg", from: "PNG", to: "JPG", format: "image/jpeg", accept: "image/png" },
  { slug: "jpg-to-png", from: "JPG", to: "PNG", format: "image/png", accept: "image/jpeg" },
  { slug: "webp-to-jpg", from: "WebP", to: "JPG", format: "image/jpeg", accept: "image/webp" },
  { slug: "jpg-to-webp", from: "JPG", to: "WebP", format: "image/webp", accept: "image/jpeg" },
  { slug: "png-to-webp", from: "PNG", to: "WebP", format: "image/webp", accept: "image/png" },
  { slug: "webp-to-png", from: "WebP", to: "PNG", format: "image/png", accept: "image/webp" },
  { slug: "pdf-to-jpg", from: "PDF", to: "JPG", format: "image/jpeg", accept: "application/pdf,.pdf" },
  { slug: "pdf-to-png", from: "PDF", to: "PNG", format: "image/png", accept: "application/pdf,.pdf" },
] as const satisfies readonly {
  slug: string;
  from: string;
  to: string;
  format: ImageOutputFormat;
  accept: string;
}[];

export type Conversion = (typeof CONVERSIONS)[number];
export type ConversionSlug = Conversion["slug"];

export function getConversion(slug: string): Conversion | undefined {
  return CONVERSIONS.find((c) => c.slug === slug);
}
