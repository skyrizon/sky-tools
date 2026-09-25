/** Community links and feedback settings. Any link left empty is hidden. */
export const DISCORD_URL = "";
export const KOFI_URL = "https://ko-fi.com/skyrizon";

export const FEEDBACK_TYPES = ["bug", "idea", "other"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_LIMITS = { title: 120, message: 4000, links: 3 };

/** Error codes the feedback API returns; the form shows them in the visitor's language. */
export type FeedbackErrorCode =
  | "type"
  | "tool"
  | "title"
  | "message"
  | "email"
  | "links"
  | "rateLimited"
  | "failed";
