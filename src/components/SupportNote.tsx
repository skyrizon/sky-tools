"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import type { Dictionary } from "@/dictionaries";
import { KOFI_URL } from "@/lib/community";

/** A friendly, optional Ko-fi nudge shown after someone finishes using a tool. */
export default function SupportNote({
  t,
  generic = false,
  className = "",
}: {
  t: Dictionary["support"];
  /** Use the heading for tools that don't produce a file (e.g. the scanner). */
  generic?: boolean;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (!KOFI_URL || dismissed) return null;

  return (
    <div
      role="status"
      className={`relative flex gap-3 rounded-lg bg-accent-soft px-4 py-3 text-left text-sm ${className}`}
    >
      <Image
        src="/kofi-avatar.webp"
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-full border-2 border-background-raised shadow-sm"
      />
      <div className="pr-5">
        <p className="font-semibold">{generic ? t.titleGeneric : t.title}</p>
        <p className="mt-0.5 text-muted">
          {t.before}{" "}
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent-hover hover:underline"
          >
            {t.link}
          </a>{" "}
          {t.after}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t.dismiss}
        className="absolute right-2 top-2 rounded p-1 text-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
