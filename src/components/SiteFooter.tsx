import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { DISCORD_URL } from "@/lib/community";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background-raised">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">
          Found a bug or have an idea?{" "}
          <Link href="/community" className="font-semibold text-accent-hover hover:underline">
            Send feedback
          </Link>
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {DISCORD_URL && (
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-semibold hover:border-accent hover:text-accent-hover"
            >
              <MessagesSquare className="h-4 w-4" strokeWidth={1.75} />
              Join Discord
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
