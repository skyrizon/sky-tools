import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { TOOLS } from "@/lib/tools";
import { DISCORD_URL } from "@/lib/community";
import FeedbackForm from "./FeedbackForm";

export const metadata: Metadata = {
  title: "Community",
  description: "Join the Sky Tools Discord, support the project on Ko-fi, or send a bug report or idea.",
};

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Community</h1>
        <p className="mt-3 text-lg text-muted">
          Found a bug or have an idea for a tool? Tell us here. Every message is read, and what
          you send shapes what gets built next.
        </p>
      </div>

      {DISCORD_URL && (
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-10 flex max-w-md flex-col gap-3 rounded-2xl border border-border-soft bg-background-raised p-6 transition hover:border-accent hover:shadow-md hover:shadow-accent/10"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-hover">
            <MessagesSquare className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <span className="font-bold group-hover:text-accent-hover">Discord</span>
          <span className="text-sm text-muted">
            Chat with other users, get help with a tool, and hear about new tools first.
          </span>
          <span className="text-sm font-semibold text-accent-hover">Join the server →</span>
        </a>
      )}

      <section className="mt-10 rounded-2xl border border-border-soft bg-background-raised p-6 sm:p-8">
        <h2 className="text-lg font-bold">Report a problem or suggest an idea</h2>
        <p className="mt-1 text-sm text-muted">
          For bugs, say what you did, what you expected, and what happened instead.
        </p>
        <FeedbackForm tools={TOOLS.map((tool) => ({ slug: tool.slug, name: tool.name }))} />
      </section>
    </div>
  );
}
