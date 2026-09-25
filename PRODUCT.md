# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences:
- **Drive-by utility users** — anyone who lands on a tool needing to get something done right now (e.g. "I need a QR code"), with no signup at all.
- **Developers / power users** — technical visitors who want precise control over tool output (e.g. error-correction level, encoding format) and may use tools repeatedly or in bulk.

## Product Purpose

Sky Tools is a growing collection of small, focused, free web tools, hosted under one site. There are no user accounts. The first tool is a QR Code Generator (text/URL, WiFi, contact card, SMS templates, optional logo, PNG export). More tools will be added over time behind the same shared foundation (layout, tool registry, community/feedback).

## Positioning

Not yet settled as a single sharp claim. Confirmed underlying facts that any future positioning must be consistent with (see Capabilities and Constraints, Evidence on Hand): every tool works fully without an account (there are no accounts); processing happens in the browser and nothing a visitor enters is stored server-side; the site is supported by voluntary Ko-fi tips; the site carries moderated Google AdSense ads; usage/traffic data is collected to inform which tools or features to build or adjust next.

## Operating Context

Visitors arrive per-tool (e.g. `/tools/qr-generator`), not through a guided funnel. Visitors can send bug reports and ideas from `/community`; submissions are posted to a Discord Forum channel via webhook. The tool roster is expected to grow; each new tool is added to a central registry (`src/lib/tools.ts`) and picked up automatically by the homepage and nav.

## Capabilities and Constraints

- No accounts, login, or saved history — accounts were removed in September 2026. Features that would need server-side storage per user are out of scope unless accounts are deliberately reintroduced.
- Site runs Google AdSense ads with content filtering/moderation enabled.
- Traffic/usage data is collected specifically to guide future tool prioritization and adjustments — not just generic analytics.
- No database. Feedback is delivered to Discord (`DISCORD_FEEDBACK_WEBHOOK_URL`, optional `DISCORD_TAG_*` forum tag IDs).
- Donations: Ko-fi (https://ko-fi.com/skyrizon), always optional and never gating anything.

## Evidence on Hand

No real customer testimonials, case studies, press, or usage data exist yet — this is a new build. Do not fabricate any.

## Product Principles

1. Every tool must work standalone with zero signup friction — there is nothing to sign up for.
2. New tools plug into one shared foundation (nav, registry, support note, link-preview images) rather than each reinventing it.
3. Ad presence is a real, confirmed constraint — future design work should accommodate ad placement. Support asks (Ko-fi) stay visible but never pushy.
4. Traffic data collection is a deliberate product input (what to build next), not an afterthought — instrumentation should be treated as a first-class concern as tools are added.
