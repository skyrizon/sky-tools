import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sky Tools",
    short_name: "Sky Tools",
    description: "Free, private web tools — QR codes, image and PDF conversion — that run in your browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fb",
    theme_color: "#1786f9",
    icons: [{ src: "/icon.png", sizes: "any", type: "image/png" }],
  };
}
