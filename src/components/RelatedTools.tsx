import Link from "next/link";
import type { Dictionary } from "@/dictionaries";
import { relatedTools, type ToolSlug } from "@/lib/tools";
import { localePath, type Locale } from "@/lib/i18n";

/** Links to other tools from a tool page — helps visitors and search engines find them. */
export default function RelatedTools({
  slug,
  lang,
  dict,
}: {
  slug: ToolSlug;
  lang: Locale;
  dict: Dictionary;
}) {
  const tools = relatedTools(slug);
  if (tools.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-6 pb-12">
      <h2 className="text-lg font-bold">{dict.common.relatedTitle}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={localePath(lang, `/tools/${tool.slug}`)}
            className="group flex items-start gap-3 rounded-2xl border border-border-soft bg-background-raised p-5 transition hover:border-accent hover:shadow-md hover:shadow-accent/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-hover">
              <tool.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-bold group-hover:text-accent-hover">{dict.tools[tool.slug].name}</span>
              <span className="text-sm text-muted">{dict.tools[tool.slug].description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
