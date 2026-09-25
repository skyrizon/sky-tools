import { getTool } from "@/lib/tools";
import { OG_CONTENT_TYPE, OG_SIZE, renderCover } from "@/lib/og-image";

const tool = getTool("image-converter")!;

export const alt = `${tool.name} — Sky Tools`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderCover({ eyebrow: "Free tool", title: tool.name, subtitle: tool.description });
}
