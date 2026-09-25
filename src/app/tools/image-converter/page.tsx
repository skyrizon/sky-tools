import { getTool } from "@/lib/tools";
import { toolJsonLd, toolMetadata } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import RelatedTools from "@/components/RelatedTools";
import ImageConverterClient from "./ImageConverterClient";
import { IMAGE_CONVERTER_FAQ } from "./content";

const tool = getTool("image-converter")!;

export const metadata = toolMetadata(tool);

export default function ImageConverterPage() {
  return (
    <>
      <JsonLd data={toolJsonLd(tool, IMAGE_CONVERTER_FAQ)} />
      <ImageConverterClient />
      <RelatedTools slug={tool.slug} />
    </>
  );
}
