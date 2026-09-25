import en from "@/dictionaries/en";
import type { ToolSlug } from "@/lib/tools";
import type { Locale } from "@/lib/i18n";
import type { FeedbackType } from "@/lib/community";

/**
 * Posts feedback into a Discord Forum channel through a webhook, so every
 * submission becomes its own post (like an issue) that can be tagged, replied
 * to, and closed in Discord.
 *
 * Env:
 * - DISCORD_FEEDBACK_WEBHOOK_URL: webhook created on the Forum channel.
 * - DISCORD_TAG_BUG / DISCORD_TAG_IDEA / DISCORD_TAG_OTHER: optional Forum tag
 *   IDs applied to the post by feedback type.
 */
const WEBHOOK_URL = process.env.DISCORD_FEEDBACK_WEBHOOK_URL ?? "";

const TAG_IDS: Record<FeedbackType, string | undefined> = {
  bug: process.env.DISCORD_TAG_BUG,
  idea: process.env.DISCORD_TAG_IDEA,
  other: process.env.DISCORD_TAG_OTHER,
};

const TYPE_COLORS: Record<FeedbackType, number> = {
  bug: 0xdc2626,
  idea: 0x1786f9,
  other: 0x5b6672,
};

export async function postFeedbackToDiscord(feedback: {
  type: FeedbackType;
  toolSlug: ToolSlug | null;
  title: string;
  message: string;
  email: string | null;
  lang: Locale;
}): Promise<void> {
  if (!WEBHOOK_URL) throw new Error("DISCORD_FEEDBACK_WEBHOOK_URL is not set.");

  // Posts are always in English so the Discord channel reads consistently.
  const typeLabel = en.community.form.types[feedback.type];
  const toolName = feedback.toolSlug ? en.tools[feedback.toolSlug].name : null;
  const tagId = TAG_IDS[feedback.type];

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Sky Tools Feedback",
      // Forum post titles are capped at 100 characters.
      thread_name: feedback.title.slice(0, 100),
      applied_tags: tagId ? [tagId] : undefined,
      // Never let user text ping @everyone, roles, or members.
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: feedback.title.slice(0, 256),
          description: feedback.message,
          color: TYPE_COLORS[feedback.type],
          fields: [
            { name: "Type", value: typeLabel, inline: true },
            { name: "Tool", value: toolName ?? "General / whole site", inline: true },
            { name: "Language", value: feedback.lang === "th" ? "Thai" : "English", inline: true },
            ...(feedback.email ? [{ name: "Contact", value: feedback.email, inline: true }] : []),
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
  }
}
