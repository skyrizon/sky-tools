import { NextResponse } from "next/server";
import { isToolSlug } from "@/lib/tools";
import { hasLocale } from "@/lib/i18n";
import {
  FEEDBACK_LIMITS,
  FEEDBACK_TYPES,
  type FeedbackErrorCode,
  type FeedbackType,
} from "@/lib/community";
import { postFeedbackToDiscord } from "@/lib/discord";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const rateLimit = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

function fail(code: FeedbackErrorCode, status = 400, headers?: HeadersInit) {
  return NextResponse.json({ code }, { status, headers });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // Hidden field that real visitors never fill in; bots usually do.
  if (typeof body?.website === "string" && body.website !== "") {
    return NextResponse.json({ ok: true });
  }

  const type = typeof body?.type === "string" ? body.type : "";
  const toolSlug = typeof body?.toolSlug === "string" ? body.toolSlug : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const lang = typeof body?.lang === "string" && hasLocale(body.lang) ? body.lang : "en";

  if (!(FEEDBACK_TYPES as readonly string[]).includes(type)) return fail("type");
  if (toolSlug !== "" && !isToolSlug(toolSlug)) return fail("tool");
  if (title === "" || title.length > FEEDBACK_LIMITS.title) return fail("title");
  if (message.length < 10 || message.length > FEEDBACK_LIMITS.message) return fail("message");
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("email");
  if ((`${title} ${message}`.match(/https?:\/\//gi) ?? []).length > FEEDBACK_LIMITS.links) {
    return fail("links");
  }

  // Counted only once a submission is valid, so fixing a typo doesn't use up the limit.
  const limited = rateLimit(clientIp(request));
  if (!limited.ok) {
    return fail("rateLimited", 429, { "Retry-After": String(limited.retryAfterSeconds) });
  }

  try {
    await postFeedbackToDiscord({
      type: type as FeedbackType,
      toolSlug: isToolSlug(toolSlug) ? toolSlug : null,
      title,
      message,
      email: email || null,
      lang,
    });
  } catch (err) {
    console.error("Feedback delivery failed:", err);
    return fail("failed", 500);
  }

  return NextResponse.json({ ok: true });
}
