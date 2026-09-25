import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import ProsePage, { proseMetadata } from "@/components/ProsePage";

export function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  return proseMetadata(params, "privacy");
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  return <ProsePage content={getDictionary(lang).privacy} />;
}
