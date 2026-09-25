import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "/", priority: 1 },
    ...TOOLS.map((tool) => ({ path: `/tools/${tool.slug}`, priority: 0.9 })),
    { path: "/community", priority: 0.5 },
  ];

  return pages.map(({ path, priority }) => ({
    url: absoluteUrl(path),
    changeFrequency: "monthly",
    priority,
  }));
}
