import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/dictionaries";
import { TOOLS } from "@/lib/tools";
import { hasLocale, localePath } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { AD_SLOTS } from "@/lib/ads";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import { ToolInfoSection } from "@/components/ToolInfo";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return pageMetadata({
    locale: lang,
    path: "/",
    title: dict.meta.homeTitle,
    description: dict.meta.homeDescription,
    absoluteTitle: true,
  });
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  const dict = getDictionary(lang);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <JsonLd data={siteJsonLd(dict, lang)} />
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">{dict.home.h1}</h1>
        <p className="mt-3 text-lg text-muted">{dict.home.intro}</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            href={localePath(lang, `/tools/${tool.slug}`)}
            className="group flex flex-col gap-3 rounded-2xl border border-border-soft bg-background-raised p-6 transition hover:border-accent hover:shadow-md hover:shadow-accent/10"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-hover">
              <tool.icon className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <span className="font-bold group-hover:text-accent-hover">{dict.tools[tool.slug].name}</span>
            <span className="text-sm text-muted">{dict.tools[tool.slug].description}</span>
          </Link>
        ))}
      </div>

      <ToolInfoSection title={dict.home.aboutTitle}>
        {dict.home.aboutBody.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </ToolInfoSection>

      <AdSlot slot={AD_SLOTS.homepageBottom} className="mt-10" />
    </div>
  );
}
