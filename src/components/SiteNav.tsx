import Link from "next/link";
import Image from "next/image";
import type { Dictionary } from "@/dictionaries";
import { KOFI_URL } from "@/lib/community";
import { localePath, type Locale } from "@/lib/i18n";
import Wordmark from "@/components/Wordmark";
import LanguageSwitch from "@/components/LanguageSwitch";

export default function SiteNav({ lang, t }: { lang: Locale; t: Dictionary["nav"] }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background-raised/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Wordmark href={localePath(lang, "/")} />

        <nav className="flex items-center gap-3 whitespace-nowrap text-sm font-medium sm:gap-6">
          <Link href={localePath(lang, "/")} className="text-muted hover:text-foreground">
            {t.tools}
          </Link>
          <Link href={localePath(lang, "/community")} className="text-muted hover:text-foreground">
            {t.community}
          </Link>
          <LanguageSwitch lang={lang} label={t.switchLabel} ariaLabel={t.switchAria} />
          {KOFI_URL && (
            <a
              href={KOFI_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.coffeeAria}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border py-1 pl-1 pr-1 text-muted hover:border-accent hover:text-accent-hover sm:pr-3"
            >
              <Image
                src="/kofi-avatar.webp"
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0 rounded-full"
              />
              <span className="hidden sm:inline">{t.coffee}</span>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
