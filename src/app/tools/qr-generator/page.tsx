import type { Metadata } from "next";
import QrGeneratorClient from "./QrGeneratorClient";

export const metadata: Metadata = { title: "QR Code Generator" };

export default function QrGeneratorPage() {
  return <QrGeneratorClient />;
}
