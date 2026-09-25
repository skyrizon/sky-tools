/* eslint-disable @next/next/no-img-element -- ImageResponse renders plain <img>, not next/image. */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import type { ToolSlug } from "@/lib/tools";

/** Shared size for every link-preview (Open Graph) image. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

type Font = { name: string; data: Buffer; weight: 400 | 600 | 700 | 800 };

let assets: Promise<{ logo: string; fonts: Font[] }> | undefined;

function loadAssets() {
  assets ??= (async () => {
    const logo = await readFile(join(process.cwd(), "public/logo-lockup.png"));
    const geistDir = join(process.cwd(), "node_modules/@fontsource/geist-sans/files");
    const thaiDir = join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans-thai/files");
    const load = async (name: string, dir: string, file: string, weight: Font["weight"]) => ({
      name,
      weight,
      data: await readFile(join(dir, file)),
    });
    // Geist for Latin text; IBM Plex Sans Thai fills in Thai glyphs Geist lacks.
    const fonts = await Promise.all([
      ...([400, 600, 800] as const).map((w) =>
        load("Geist", geistDir, `geist-sans-latin-${w}-normal.woff`, w),
      ),
      ...([400, 600, 700] as const).map((w) =>
        load("Plex Thai", thaiDir, `ibm-plex-sans-thai-thai-${w}-normal.woff`, w),
      ),
    ]);
    return { logo: `data:image/png;base64,${logo.toString("base64")}`, fonts };
  })();
  return assets;
}

/** Cover for a tool page, in the page's language. */
export async function renderToolCover(params: Promise<{ lang: string }>, slug: ToolSlug) {
  const { lang } = await params;
  const dict = getDictionary(hasLocale(lang) ? lang : "en");
  return renderCover({
    eyebrow: dict.meta.ogFreeTool,
    title: dict.tools[slug].name,
    subtitle: dict.tools[slug].description,
  });
}

/**
 * Renders the Sky Tools cover used when a page is shared on Discord, LINE,
 * Facebook, X, etc. Follows the site's look: paper background, one blue accent.
 */
export async function renderCover({ eyebrow, title, subtitle }: {
  eyebrow?: string;
  title: string;
  subtitle: string;
}) {
  const { logo, fonts } = await loadAssets();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f7f9fb",
          fontFamily: "Geist, Plex Thai",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 0 56px 72px",
          }}
        >
          <span style={{ fontSize: 30, fontWeight: 800, color: "#1786f9", letterSpacing: "-0.01em" }}>
            Sky Tools
          </span>

          <div style={{ display: "flex", flexDirection: "column", paddingRight: 40 }}>
            {eyebrow && (
              <span
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  marginBottom: 22,
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "#eaf4ff",
                  color: "#0f6cd1",
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {eyebrow}
              </span>
            )}
            <span
              style={{
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "#10151c",
              }}
            >
              {title}
            </span>
            <span style={{ marginTop: 22, fontSize: 28, lineHeight: 1.4, color: "#5b6672" }}>
              {subtitle}
            </span>
          </div>

          <span style={{ fontSize: 24, fontWeight: 600, color: "#0f6cd1" }}>
            tools.skyrizon.online
          </span>
        </div>

        <div
          style={{
            width: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(160deg, #5eb0ff 0%, #1786f9 100%)",
          }}
        >
          <div
            style={{
              width: 260,
              height: 260,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 56,
              background: "#ffffff",
              boxShadow: "0 24px 60px rgba(15, 108, 209, 0.35)",
            }}
          >
            <img src={logo} width={210} height={210} alt="" />
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
