import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import ProsePage, { proseMetadata } from "@/components/ProsePage";

export function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  return proseMetadata(params, "about");
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  return <ProsePage content={getDictionary(lang).about} />;
}
