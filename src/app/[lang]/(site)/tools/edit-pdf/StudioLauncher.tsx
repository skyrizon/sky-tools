import { Check, SquareArrowOutUpRight } from "lucide-react";
import type { Dictionary } from "@/dictionaries";

/** Card on the Edit PDF page that opens the full-screen studio in a new tab. */
export default function StudioLauncher({ href, t }: { href: string; t: Dictionary["editPdf"]["launch"] }) {
  return (
    <div className="mt-8 grid gap-8 rounded-2xl border border-border-soft bg-background-raised p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <h2 className="text-lg font-bold">{t.title}</h2>
        <p className="mt-2 text-muted">{t.body}</p>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {t.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-hover" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col items-start gap-2 md:items-center">
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-2 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-accent/30 hover:brightness-105"
        >
          {t.open}
          <SquareArrowOutUpRight className="h-4 w-4" />
        </a>
        <span className="text-xs text-muted">{t.newTab}</span>
      </div>
    </div>
  );
}
