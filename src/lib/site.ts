/** Canonical origin of the live site; used for sitemap, canonical URLs, and JSON-LD. */
export const SITE_URL = "https://tools.skyrizon.online";
export const SITE_NAME = "Sky Tools";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
