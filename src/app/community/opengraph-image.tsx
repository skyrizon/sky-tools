import { OG_CONTENT_TYPE, OG_SIZE, renderCover } from "@/lib/og-image";

export const alt = "Sky Tools Community";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderCover({
    eyebrow: "Community",
    title: "Help shape Sky Tools.",
    subtitle: "Report a problem or suggest an idea. Every message is read.",
  });
}
