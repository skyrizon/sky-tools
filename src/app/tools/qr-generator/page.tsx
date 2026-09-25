import type { Metadata } from "next";
import { getTool } from "@/lib/tools";
import QrGeneratorClient from "./QrGeneratorClient";

const tool = getTool("qr-generator")!;

export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function QrGeneratorPage() {
  return <QrGeneratorClient />;
}
