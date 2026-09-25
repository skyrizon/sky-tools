import { OG_CONTENT_TYPE, OG_SIZE, renderCover } from "@/lib/og-image";

export const alt = "Sky Tools — free web tools, no sign-up required";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderCover({
    title: "Free tools, no sign-up required.",
    subtitle: "QR codes, image and PDF conversion, and more — right in your browser.",
  });
}
