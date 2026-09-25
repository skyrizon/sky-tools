import type { FaqItem } from "@/lib/seo";

/** Shown on the page and emitted as FAQPage structured data. */
export const QR_FAQ: FaqItem[] = [
  {
    q: "Do I need an account to generate a QR code?",
    a: "No. There are no accounts on Sky Tools — generating, previewing, and downloading a QR code as PNG or SVG all work straight away.",
  },
  {
    q: "Will my WiFi password be visible in the QR code?",
    a: "Yes — WiFi QR codes encode the network name, password, and encryption type directly, which is how a phone camera can join the network without anyone typing the password. Only share the code with people you'd trust with the password itself.",
  },
  {
    q: "Can I add a logo to the center of the code?",
    a: "Yes, under \"Logo (optional).\" The generator automatically increases error correction to keep the code scannable once part of it is covered by the logo.",
  },
  {
    q: "What's the difference between PNG and SVG downloads?",
    a: "PNG is a fixed-resolution image, good for most uses (print, messaging apps, documents). SVG is vector-based and stays sharp at any size, which is better if you plan to resize the code significantly or edit it in design software.",
  },
];
