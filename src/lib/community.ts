/** Community links and feedback settings. Any link left empty is hidden. */
export const DISCORD_URL = "";
export const KOFI_URL = "https://ko-fi.com/skyrizon";

export const FEEDBACK_TYPES = [
  { value: "bug", label: "Report a problem" },
  { value: "idea", label: "Suggest an idea" },
  { value: "other", label: "Something else" },
] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]["value"];

export const FEEDBACK_LIMITS = { title: 120, message: 4000 };
