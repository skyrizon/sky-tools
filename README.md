# Sky Tools

Free, private web tools at [tools.skyrizon.online](https://tools.skyrizon.online). Every tool runs
in the browser: files and text never leave the visitor's device. There are no accounts and no
database.

Built with Next.js 16 (App Router), React 19, and Tailwind CSS 4.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DISCORD_FEEDBACK_WEBHOOK_URL` | For feedback | Webhook on a Discord **Forum** channel; each `/community` submission becomes a post |
| `DISCORD_TAG_BUG` / `DISCORD_TAG_IDEA` / `DISCORD_TAG_OTHER` | No | Forum tag IDs applied by feedback type |

Put them in `.env.local` for development and in Vercel → Settings → Environment Variables for
production.

## Languages

English is served at unprefixed URLs (`/tools/qr-generator`) and Thai under `/th`
(`/th/tools/qr-generator`). All pages live in `src/app/[lang]/`; `src/proxy.ts` rewrites
unprefixed requests to `/en/...` and redirects explicit `/en/...` URLs to the clean one. Every
string is in `src/dictionaries/en.ts` and `th.ts` (the Thai file is type-checked against the
English one, so a missing translation fails the build).

## Adding a tool

1. Add an entry to `TOOLS` in `src/lib/tools.ts` (slug, category, icon).
2. Add its text under `tools` — plus any UI strings, explanation, and FAQ — in both
   `src/dictionaries/en.ts` and `th.ts`.
3. Create `src/app/[lang]/tools/<slug>/page.tsx` using `ToolPageShell` (heading, explanation,
   FAQ, ad, related tools, and JSON-LD) around a `*Client.tsx` for the interactive part.
4. Copy an existing `opengraph-image.tsx` for the link-preview image.

The homepage, sitemap (with hreflang), and "More free tools" links pick the new tool up
automatically.

## Where things live

- `src/lib/tools.ts`: tool registry
- `src/lib/seo.ts`, `src/lib/i18n.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`: SEO and languages
- `src/lib/og-image.tsx`: shared link-preview image design
- `src/lib/discord.ts`, `src/app/api/feedback/route.ts`: feedback → Discord (rate-limited)
- `src/lib/community.ts`: Discord / Ko-fi links
- `src/lib/ads.ts`, `src/components/AdSlot.tsx`: AdSense
