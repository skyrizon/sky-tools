import Link from "next/link";
import { relatedTools } from "@/lib/tools";

/** Links to other tools from a tool page — helps visitors and search engines find them. */
export default function RelatedTools({ slug }: { slug: string }) {
  const tools = relatedTools(slug);
  if (tools.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-6 pb-12">
      <h2 className="text-lg font-bold">More free tools</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="group flex items-start gap-3 rounded-2xl border border-border-soft bg-background-raised p-5 transition hover:border-accent hover:shadow-md hover:shadow-accent/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-hover">
              <tool.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-bold group-hover:text-accent-hover">{tool.name}</span>
              <span className="text-sm text-muted">{tool.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
