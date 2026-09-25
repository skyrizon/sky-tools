import { OG_CONTENT_TYPE, OG_SIZE, renderToolCover } from "@/lib/og-image";
import { LOCALES } from "@/lib/i18n";

export const alt = "Sky Tools";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Render at build time for each language instead of on every request.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default function Image({ params }: { params: Promise<{ lang: string }> }) {
  return renderToolCover(params, "image-compressor");
}
