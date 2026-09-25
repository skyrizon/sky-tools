import { NextResponse } from "next/server";
import { getTool } from "@/lib/tools";
import { FEEDBACK_LIMITS, FEEDBACK_TYPES, type FeedbackType } from "@/lib/community";
import { postFeedbackToDiscord } from "@/lib/discord";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const rateLimit = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });
const MAX_LINKS = 3;

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

  if (!FEEDBACK_TYPES.some((option) => option.value === type)) {
    return NextResponse.json({ error: "Please choose a feedback type." }, { status: 400 });
  }
  if (toolSlug !== "" && !getTool(toolSlug)) {
    return NextResponse.json({ error: "Unknown tool." }, { status: 400 });
  }
  if (title === "" || title.length > FEEDBACK_LIMITS.title) {
    return NextResponse.json(
      { error: `Please add a title (up to ${FEEDBACK_LIMITS.title} characters).` },
      { status: 400 },
    );
  }
  if (message.length < 10 || message.length > FEEDBACK_LIMITS.message) {
    return NextResponse.json(
      { error: `Please add a few details (10 to ${FEEDBACK_LIMITS.message} characters).` },
      { status: 400 },
    );
  }
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if ((`${title} ${message}`.match(/https?:\/\//gi) ?? []).length > MAX_LINKS) {
    return NextResponse.json(
      { error: `Please include no more than ${MAX_LINKS} links.` },
      { status: 400 },
    );
  }

  // Counted only once a submission is valid, so fixing a typo doesn't use up the limit.
  const limited = rateLimit(clientIp(request));
  if (!limited.ok) {
    return NextResponse.json(
      { error: "You've sent a lot of feedback in a short time. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  try {
    await postFeedbackToDiscord({
      type: type as FeedbackType,
      toolSlug: toolSlug || null,
      title,
      message,
      email: email || null,
    });
  } catch (err) {
    console.error("Feedback delivery failed:", err);
    return NextResponse.json(
      { error: "We couldn't send your feedback right now. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
