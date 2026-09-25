import type { FaqItem } from "@/lib/seo";

/** Shown on the page and emitted as FAQPage structured data. */
export const IMAGE_CONVERTER_FAQ: FaqItem[] = [
  {
    q: "Is my file uploaded anywhere?",
    a: "No. The whole conversion — including reading a PDF's pages — runs in your browser using JavaScript and the Canvas API. Nothing is sent over the network.",
  },
  {
    q: "Which format should I pick?",
    a: "WebP for the smallest file size at good quality (most modern apps and browsers support it). JPG for maximum compatibility with older software. PNG when you need transparency or lossless quality, e.g. for logos or screenshots.",
  },
  {
    q: "Can I convert a multi-page PDF?",
    a: "Yes — each page becomes its own separate image, listed individually with its own download button, plus a \"Download all as ZIP\" option that bundles the whole set into a single .zip file.",
  },
  {
    q: "Why did my PNG get bigger after converting to JPG?",
    a: "JPG compression is tuned for photos with smooth color gradients; flat-color or text-heavy images (like screenshots or logos) can sometimes compress worse than PNG's lossless format. Try WebP or PNG instead if that happens.",
  },
];
