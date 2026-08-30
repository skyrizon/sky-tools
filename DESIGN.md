---
name: CloudTools
description: A growing collection of free, no-nonsense web tools, starting with a QR code generator.
colors:
  accent: "#1786f9"
  accent-2: "#5eb0ff"
  accent-hover: "#0f6cd1"
  accent-soft: "#eaf4ff"
  background: "#f7f9fb"
  background-raised: "#ffffff"
  foreground: "#10151c"
  muted: "#5b6672"
  border: "#e2e7ec"
  border-soft: "#edf1f4"
  error: "#dc2626"
  error-soft: "#fef2f2"
typography:
  display:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "8px"
  lg: "16px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "linear-gradient({colors.accent}, {colors.accent-2})"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "linear-gradient({colors.accent}, {colors.accent-2})"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.background-raised}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.background-raised}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: CloudTools

## Overview

**Creative North Star: "The Quiet Toolbench"**

CloudTools looks like a well-organized workshop, not a storefront. Every surface exists to help someone finish a task in seconds — generate a code, download it, move on — so the interface stays plain, sturdy, and confident through restraint rather than decoration. A single calm, trustworthy blue — taken directly from the CloudTools logo mark — is the only color the system spends deliberately; everything else is white space, soft neutral cards, and legible type doing the actual work.

This is a utility identity, not a marketing one. It explicitly rejects the glossy SaaS-landing-page register (no big gradient hero sections, no glassmorphism, no illustration-heavy pitch energy) and the opposite failure mode of a dense enterprise dashboard (no cramped data tables, no wall-to-wall controls). As more tools join the registry, each one should feel like it was carved from the same quiet toolbench, not bolted on.

**Key Characteristics:**
- Calm, single-accent blue used sparingly against a near-white neutral field
- Flat-leaning, restrained elevation — shadows separate, they don't decorate
- Generous whitespace even as more tools and more UI are added
- Quietly refined component detailing (smooth radii, considered gradients) rather than bare-framework defaults

## Colors

A near-monochrome neutral field with one deliberate accent; nothing else competes for attention.

### Primary
- **Toolbench Blue** (`#1786f9`): The system's only accent, sampled directly from the CloudTools logo mark. Buttons, active nav states, links, and focus rings. Paired with a lighter blue in gradients; never used as a large background fill.
- **Toolbench Blue, lifted** (`#5eb0ff`): The light end of the primary gradient (`accent` → `accent-2`) on primary buttons. Not used standalone.
- **Toolbench Blue, pressed** (`#0f6cd1`): Hover/link-active state — a deepened version of the primary, not a different hue.

### Neutral
- **Paper** (`#f7f9fb`): Page background. Warmer and softer than pure white so raised cards read as a distinct surface.
- **Card White** (`#ffffff`): Raised surfaces — cards, the nav bar, form panels.
- **Ink** (`#10151c`): Primary text.
- **Slate Muted** (`#5b6672`): Secondary text — descriptions, helper copy, placeholders, timestamps.
- **Hairline** (`#e2e7ec`): Default borders — inputs, dividers, card outlines that need to read clearly.
- **Hairline Soft** (`#edf1f4`): Quieter borders — card outlines that should recede, like history-grid cards.
- **Accent Wash** (`#eaf4ff`): The palest blue tint — hover backgrounds and focus-ring glow, never body text or borders.

### Semantic
- **Alert Red** (`#dc2626`): Error text and destructive actions (e.g. "Delete" in the history list).
- **Alert Red Wash** (`#fef2f2`): Background for inline error banners.

### Named Rules
**The One Accent Rule.** Blue is the only hue in the system. Any new tool that needs a second signal color (success, warning) should reach for the neutral scale plus the existing red before introducing a new hue — CloudTools does not accumulate a rainbow of per-tool accents.

## Typography

**Display/Body/Label Font:** Geist Sans (with `system-ui, sans-serif` fallback)
**Mono Font:** Geist Mono (with `ui-monospace, monospace` fallback) — reserved for any future code/data-output display; not yet used in shipped UI.

**Character:** A single clean geometric-humanist sans carries every weight of the system — page titles, body copy, and buttons all read as the same voice, distinguished only by size and weight, never by a second typeface.

### Hierarchy
- **Display** (800, 1.875rem/30px, 1.2 line-height, −0.01em tracking): Homepage hero heading only ("Free tools, no sign-up required.").
- **Headline** (700, 1.5rem/24px, 1.25 line-height): Page-level titles inside a tool or section ("QR Code Generator", "My QR Codes").
- **Title** (700, 1.125rem/18px, 1.3 line-height): Card/nav-level titles — the CloudTools wordmark, auth-card headings, tool-card names.
- **Body** (400, 1rem/16px, 1.6 line-height): Paragraph copy, descriptions, form helper text.
- **Label** (600, 0.875rem/14px, 1.4 line-height): Form field labels, button text, nav links — always semibold, never regular weight, so interactive text stays visually distinct from body copy.

### Named Rules
**The No-Second-Typeface Rule.** Every future tool uses Geist Sans for UI text. A tool that displays user data verbatim (e.g. a hypothetical JSON formatter) may use Geist Mono for that data only — never for labels, buttons, or headings.

## Layout

A single centered content column (`max-w-md` for auth forms, `max-w-5xl` for tool and listing pages), never edge-to-edge. Generous vertical rhythm: sections separate with large padding (`py-12`–`py-16`) rather than dividing lines. The tool grid (homepage cards, saved-history cards) is a responsive CSS grid — 1 column on mobile, 2 on tablet, up to 3 on desktop — with consistent `gap-4` between cards. Forms stack fields vertically with `gap-4` between them; there is no multi-column form layout anywhere in the system, keeping every tool's form scannable top-to-bottom.

## Elevation & Depth

CloudTools stays flat by default and uses elevation only functionally, never decoratively. Cards separate from the page with a soft border plus a barely-there ambient shadow — never a heavy drop shadow. Only the primary action (the gradient button) carries a colored shadow, which doubles as an implicit "this is the one thing to click" signal. Depth is not used to convey hierarchy between neutral surfaces; a border does that job instead.

### Shadow Vocabulary
- **Ambient card lift** (`box-shadow: 0 10px 25px -10px rgb(0 0 0 / 0.05)`, i.e. Tailwind's `shadow-lg shadow-black/5`): Under raised cards (auth panels) to lift them off the page without looking heavy.
- **Primary action glow** (`box-shadow: 0 4px 12px -2px rgb(23 134 249 / 0.3)`, i.e. `shadow-md shadow-accent/30`): Exclusively on the primary gradient button, tinted with the accent color rather than neutral black.

### Named Rules
**The One Shadow Rule.** At most one element per screen carries the tinted "primary action" shadow. If a screen has no single primary action, no element gets it.

## Shapes

Two radius steps, applied consistently by surface type: small controls (buttons, inputs, form fields) use an 8px radius (`rounded-lg`); containers (cards, panels) use a generous 16px radius (`rounded-2xl`). Pill shapes (`rounded-full`) are reserved for toggle/segmented controls, like the QR-type selector chips. Borders are always 1px and hairline-colored — never accent-colored except on focus. No clipping, masking, or angular/cut corners anywhere in the system.

## Components

### Buttons
- **Shape:** 8px radius (`rounded-lg`) on all buttons; the QR-type selector uses full-pill (`rounded-full`) instead, since it behaves as a segmented toggle, not a button.
- **Primary:** White text on a blue-to-lighter-blue gradient (`from-accent to-accent-2`), bold label weight, `px-5 py-2.5` padding, tinted shadow (see Elevation).
- **Secondary / Outline:** Transparent background, hairline border, foreground-colored text; hover fills with the page background color (`hover:bg-background`) rather than a border-color change.
- **Text link:** Accent-hover blue, underline only on hover.
- **Hover / Focus:** Primary buttons brighten slightly (`hover:brightness-105`) rather than darkening — keeps the gradient's character on hover instead of flattening it. Disabled state drops opacity to 60%, no color change.

### Cards / Containers
- **Corner Style:** 16px radius (`rounded-2xl`).
- **Background:** Card White (`#ffffff`) against the Paper page background.
- **Border:** 1px Hairline Soft, sometimes upgraded to plain Hairline for auth-style panels that need to read more distinctly.
- **Shadow Strategy:** Ambient card lift only on auth-style panels; plain history/tool-listing cards stay borderless-shadow, relying on the border alone.
- **Internal Padding:** 24–32px (`p-6` to `p-8`).

### Inputs / Fields
- **Style:** 1px Hairline border, Card White background, 8px radius, `px-3 py-2.5` padding.
- **Focus:** Border shifts to accent blue plus a soft 4px accent-tinted ring (`focus:ring-4 focus:ring-accent-soft`) — no glow/shadow, the ring is the only focus treatment.
- **Error:** Inline banner above the field, Alert Red text on Alert Red Wash background, not a red border on the field itself (established pattern in login/register forms; keep it consistent as new tools add validation).

### Navigation
- Sticky top bar, Card White at 80% opacity with backdrop blur, Hairline bottom border. The logo is a designed raster asset (`/logo-lockup.png`: a cloud-and-magnifying-glass mark above the "Cloud Tools" wordmark, both in Toolbench Blue) rendered via the shared `Wordmark` component — nav uses it at 28px tall, auth/dashboard headers at 48px tall. This is the system's one confirmed logo asset; do not recreate it as coded text/SVG, and do not add a second icon next to it. Nav links use Label-weight Slate Muted text that turns Ink on hover — no underline, no background pill. The primary CTA ("Sign up") is the only nav item styled as a button.

### Signature Component: Logo mark
The CloudTools mark — a cloud silhouette containing a magnifying glass with a sparkle — is a fixed brand asset (`public/logo-lockup.png`, sourced from the original logo file with its incidental "Skyrizon" placeholder tagline cropped out). Never redraw, recolor, or re-render it as SVG/text; only resize it as a whole image. The favicon (`src/app/icon.png`) is a square-padded crop of the same icon glyph.

## Do's and Don'ts

### Do:
- **Do** keep blue as the system's only hue; reach for the neutral or red scale before introducing a new color.
- **Do** use the gradient + tinted shadow combination only for the single primary action on a screen.
- **Do** keep body and label text on Geist Sans; reserve Geist Mono strictly for verbatim data/code display in future tools.
- **Do** keep forms single-column and vertically stacked, regardless of how many fields a new tool needs.

### Don't:
- **Don't** introduce glassmorphism, large gradient hero sections, or illustration-heavy marketing composition — CloudTools is a toolbench, not a landing page.
- **Don't** build dense, data-table-heavy dashboard layouts — keep spacing generous even as more saved items or tools accumulate.
- **Don't** add a second accent color for a new tool's "brand" — every tool shares the one blue identity.
- **Don't** use heavy neutral drop shadows; if a surface needs to lift, use the ambient card-lift value or the accent-tinted primary-action shadow, never a generic dark shadow.
