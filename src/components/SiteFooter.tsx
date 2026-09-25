import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import type { Dictionary } from "@/dictionaries";
import { DISCORD_URL } from "@/lib/community";
import { localePath, type Locale } from "@/lib/i18n";

export default function SiteFooter({ lang, t }: { lang: Locale; t: Dictionary["footer"] }) {
  const links = [
    { href: "/about", label: t.about },
    { href: "/privacy", label: t.privacy },
    { href: "/terms", label: t.terms },
  ];

  return (
    <footer className="border-t border-border bg-background-raised">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 text-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted">
            {t.prompt}{" "}
            <Link
              href={localePath(lang, "/community")}
              className="font-semibold text-accent-hover hover:underline"
            >
              {t.sendFeedback}
            </Link>
          </p>

          {DISCORD_URL && (
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start rounded-lg border border-border px-3 py-2 font-semibold hover:border-accent hover:text-accent-hover"
            >
              <MessagesSquare className="h-4 w-4" strokeWidth={1.75} />
              {t.joinDiscord}
            </a>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">{t.tagline}</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-muted">
            {links.map((link) => (
              <Link key={link.href} href={localePath(lang, link.href)} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
