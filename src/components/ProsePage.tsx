import type { Metadata } from "next";
import { getDictionary, type Dictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

type ProseKey = "about" | "privacy" | "terms";

type ProseContent = {
  title: string;
  metaDescription: string;
  updated?: string;
  sections: { heading: string; body: string[] }[];
};

/** generateMetadata for a text page (About, Privacy, Terms). */
export async function proseMetadata(
  params: Promise<{ lang: string }>,
  key: ProseKey,
): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const content: ProseContent = getDictionary(lang)[key];
  return pageMetadata({ locale: lang, path: `/${key}`, title: content.title, description: content.metaDescription });
}

/** A simple long-form text page built from a dictionary section. */
export default function ProsePage({ content }: { content: Dictionary[ProseKey] }) {
  const prose: ProseContent = content;
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{prose.title}</h1>
      {prose.updated && <p className="mt-2 text-sm text-muted">{prose.updated}</p>}
      <div className="mt-10 flex flex-col gap-8">
        {prose.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-bold">{section.heading}</h2>
            <div className="mt-2 flex flex-col gap-3 leading-relaxed text-muted">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
