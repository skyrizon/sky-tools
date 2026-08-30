# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences:
- **Drive-by utility users** — anyone who lands on a tool needing to get something done right now (e.g. "I need a QR code"), with zero forced signup for the core task.
- **Developers / power users** — technical visitors who want precise control over tool output (e.g. error-correction level, encoding format) and may use tools repeatedly or in bulk.

## Product Purpose

Sky Tools is a growing collection of small, focused, free web tools, hosted under one site and one account system. The first tool is a QR Code Generator (text/URL, WiFi, contact card, SMS templates, optional logo, PNG export). More tools will be added over time behind the same shared foundation (auth, history, layout, tool registry).

## Positioning

Not yet settled as a single sharp claim. Confirmed underlying facts that any future positioning must be consistent with (see Capabilities and Constraints, Evidence on Hand): the core tool works without an account; creating an account unlocks some functionality (currently: saving generated output to a personal history) that stays unavailable to anonymous visitors; the site carries moderated Google AdSense ads; usage/traffic data is collected to inform which tools or features to build or adjust next.

## Operating Context

Visitors arrive per-tool (e.g. `/tools/qr-generator`), not through a guided funnel. Registered users can revisit `/dashboard` to see and manage previously generated output. The tool roster is expected to grow; each new tool is added to a central registry (`src/lib/tools.ts`) and picked up automatically by the homepage and nav.

## Capabilities and Constraints

- Account is optional for using a tool's core function; some functionality is gated behind login (confirmed pattern: saving QR output to history requires an account — future tools may gate different specific functionality, to be decided per-tool).
- Site runs Google AdSense ads with content filtering/moderation enabled.
- Traffic/usage data is collected specifically to guide future tool prioritization and adjustments — not just generic analytics.
- Auth: email/password (Auth.js, credentials provider, JWT sessions).
- Data: hosted Postgres (Neon or Supabase — provider not yet finalized) via Prisma.

## Evidence on Hand

No real customer testimonials, case studies, press, or usage data exist yet — this is a new build. Do not fabricate any.

## Product Principles

1. Every tool must work standalone with zero signup friction for its core function — accounts add value, they don't gate entry.
2. New tools plug into one shared foundation (auth, history, nav, registry) rather than each reinventing it.
3. Ad presence and account-gating are real, confirmed constraints — future design work should accommodate ad placement and a visible-but-not-pushy account upsell, not pretend the site is ad-free or fully open.
4. Traffic data collection is a deliberate product input (what to build next), not an afterthought — instrumentation should be treated as a first-class concern as tools are added.
