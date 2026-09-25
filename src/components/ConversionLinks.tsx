import Link from "next/link";
import type { Dictionary } from "@/dictionaries";
import { CONVERSIONS, type ConversionSlug } from "@/lib/conversions";
import { localePath, type Locale } from "@/lib/i18n";

/** Links between the Image Converter and its format landing pages. */
export default function ConversionLinks({
  lang,
  dict,
  current,
}: {
  lang: Locale;
  dict: Dictionary;
  /** The landing page being viewed; adds a link back to the full converter. */
  current?: ConversionSlug;
}) {
  const chip =
    "rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent-hover";

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{dict.conversions.linksTitle}</h2>
      <nav className="mt-4 flex flex-wrap gap-2">
        {CONVERSIONS.filter((c) => c.slug !== current).map((c) => (
          <Link key={c.slug} href={localePath(lang, `/convert/${c.slug}`)} className={chip}>
            {dict.conversions.pairs[c.slug].h1}
          </Link>
        ))}
        {current && (
          <Link
            href={localePath(lang, "/tools/image-converter")}
            className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent-hover hover:underline"
          >
            {dict.conversions.allFormats} →
          </Link>
        )}
      </nav>
    </section>
  );
}
