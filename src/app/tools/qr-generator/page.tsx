import { getTool } from "@/lib/tools";
import { toolJsonLd, toolMetadata } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import RelatedTools from "@/components/RelatedTools";
import QrGeneratorClient from "./QrGeneratorClient";
import { QR_FAQ } from "./content";

const tool = getTool("qr-generator")!;

export const metadata = toolMetadata(tool);

export default function QrGeneratorPage() {
  return (
    <>
      <JsonLd data={toolJsonLd(tool, QR_FAQ)} />
      <QrGeneratorClient />
      <RelatedTools slug={tool.slug} />
    </>
  );
}
