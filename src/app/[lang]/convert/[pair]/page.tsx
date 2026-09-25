import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/dictionaries";
import { CONVERSIONS, getConversion } from "@/lib/conversions";
import { format, hasLocale } from "@/lib/i18n";
import { conversionJsonLd, pageMetadata } from "@/lib/seo";
import ConversionLinks from "@/components/ConversionLinks";
import ToolPageShell from "@/components/ToolPageShell";
import ImageConverterClient from "../../tools/image-converter/ImageConverterClient";

export const dynamicParams = false;

export function generateStaticParams() {
  return CONVERSIONS.map((c) => ({ pair: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/convert/[pair]">): Promise<Metadata> {
  const { lang, pair } = await params;
  const conversion = getConversion(pair);
  if (!hasLocale(lang) || !conversion) return {};
  const text = getDictionary(lang).conversions.pairs[conversion.slug];
  return pageMetadata({
    locale: lang,
    path: `/convert/${conversion.slug}`,
    title: text.seoTitle,
    description: text.metaDescription,
  });
}

export default async function ConversionPage({ params }: PageProps<"/[lang]/convert/[pair]">) {
  const { lang, pair } = await params;
  const conversion = getConversion(pair);
  if (!hasLocale(lang) || !conversion) notFound();
  const dict = getDictionary(lang);
  const text = dict.conversions.pairs[conversion.slug];
  const names = { from: conversion.from, to: conversion.to };

  return (
    <ToolPageShell
      slug="image-converter"
      lang={lang}
      dict={dict}
      heading={text.h1}
      intro={text.intro}
      howTitle={format(dict.conversions.whyTitle, names)}
      howBody={text.body}
      faq={text.faq}
      structuredData={conversionJsonLd(dict, lang, conversion.slug)}
      extra={<ConversionLinks lang={lang} dict={dict} current={conversion.slug} />}
    >
      <ImageConverterClient
        t={{
          ...dict.converter.ui,
          dropTitle: format(dict.conversions.dropTitle, names),
          dropHint: format(dict.conversions.dropHint, names),
        }}
        support={dict.support}
        initialFormat={conversion.format}
        accept={conversion.accept}
      />
    </ToolPageShell>
  );
}
