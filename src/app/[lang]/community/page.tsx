import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { getDictionary } from "@/dictionaries";
import { TOOLS } from "@/lib/tools";
import { DISCORD_URL } from "@/lib/community";
import { hasLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import FeedbackForm from "./FeedbackForm";

export async function generateMetadata({ params }: PageProps<"/[lang]/community">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).community;
  return pageMetadata({ locale: lang, path: "/community", title: t.metaTitle, description: t.metaDescription });
}

export default async function CommunityPage({ params }: PageProps<"/[lang]/community">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);
  const t = dict.community;

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.h1}</h1>
        <p className="mt-3 text-lg text-muted">{t.intro}</p>
      </div>

      {DISCORD_URL && (
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-10 flex max-w-md flex-col gap-3 rounded-2xl border border-border-soft bg-background-raised p-6 transition hover:border-accent hover:shadow-md hover:shadow-accent/10"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-hover">
            <MessagesSquare className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <span className="font-bold group-hover:text-accent-hover">{t.discordTitle}</span>
          <span className="text-sm text-muted">{t.discordBody}</span>
          <span className="text-sm font-semibold text-accent-hover">{t.discordCta} →</span>
        </a>
      )}

      <section className="mt-10 rounded-2xl border border-border-soft bg-background-raised p-6 sm:p-8">
        <h2 className="text-lg font-bold">{t.formTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.formHint}</p>
        <FeedbackForm
          lang={lang}
          t={t.form}
          tools={TOOLS.map((tool) => ({ slug: tool.slug, name: dict.tools[tool.slug].name }))}
        />
      </section>
    </div>
  );
}
