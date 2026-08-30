import type { Metadata } from "next";
import ImageConverterClient from "./ImageConverterClient";

export const metadata: Metadata = { title: "Image Converter" };

export default function ImageConverterPage() {
  return <ImageConverterClient />;
}
