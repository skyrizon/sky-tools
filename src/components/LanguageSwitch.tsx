"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import { localePath, stripLocale, type Locale } from "@/lib/i18n";

/** Links to the same page in the other language. */
export default function LanguageSwitch({
  lang,
  label,
  ariaLabel,
}: {
  lang: Locale;
  label: string;
  ariaLabel: string;
}) {
  const pathname = usePathname() ?? "/";
  const target: Locale = lang === "th" ? "en" : "th";
  const href = localePath(target, stripLocale(pathname));

  return (
    <Link
      href={href}
      hrefLang={target}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 text-muted hover:text-foreground"
    >
      <Languages className="h-4 w-4" strokeWidth={1.75} />
      {label}
    </Link>
  );
}
