import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale } from "@/lib/i18n";
import ProsePage, { proseMetadata } from "@/components/ProsePage";

export function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  return proseMetadata(params, "terms");
}

export default async function TermsPage({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return null;
  return <ProsePage content={getDictionary(lang).terms} />;
}
