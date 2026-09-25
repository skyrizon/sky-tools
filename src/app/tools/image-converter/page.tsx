import type { Metadata } from "next";
import { getTool } from "@/lib/tools";
import ImageConverterClient from "./ImageConverterClient";

const tool = getTool("image-converter")!;

export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function ImageConverterPage() {
  return <ImageConverterClient />;
}
