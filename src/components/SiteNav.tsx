import Link from "next/link";
import Image from "next/image";
import { KOFI_URL } from "@/lib/community";
import Wordmark from "@/components/Wordmark";

export default function SiteNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background-raised/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Wordmark />

        <nav className="flex items-center gap-3 whitespace-nowrap text-sm font-medium sm:gap-6">
          <Link href="/" className="text-muted hover:text-foreground">
            Tools
          </Link>
          <Link href="/community" className="text-muted hover:text-foreground">
            Community
          </Link>
          {KOFI_URL && (
            <a
              href={KOFI_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Support Sky Tools on Ko-fi"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border py-1 pl-1 pr-1 text-muted hover:border-accent hover:text-accent-hover sm:pr-3"
            >
              <Image
                src="/kofi-avatar.webp"
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0 rounded-full"
              />
              <span className="hidden sm:inline">Buy me a coffee</span>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
