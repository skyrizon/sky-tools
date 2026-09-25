import { PDFDocument } from "pdf-lib";

/** Editable document properties, as shown in a PDF reader's "Document Properties". */
export type PdfMetadata = {
  title: string;
  author: string;
  subject: string;
  /** Comma-separated. */
  keywords: string;
};

/** Read-only details shown next to the editable properties. */
export type PdfMetadataInfo = {
  creator: string;
  producer: string;
  created: Date | null;
  modified: Date | null;
};

export async function readMetadata(file: File): Promise<{ metadata: PdfMetadata; info: PdfMetadataInfo }> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  const safe = <T,>(get: () => T | undefined): T | undefined => {
    try {
      return get();
    } catch {
      return undefined;
    }
  };
  return {
    metadata: {
      title: safe(() => doc.getTitle()) ?? "",
      author: safe(() => doc.getAuthor()) ?? "",
      subject: safe(() => doc.getSubject()) ?? "",
      keywords: safe(() => doc.getKeywords()) ?? "",
    },
    info: {
      creator: safe(() => doc.getCreator()) ?? "",
      producer: safe(() => doc.getProducer()) ?? "",
      created: safe(() => doc.getCreationDate()) ?? null,
      modified: safe(() => doc.getModificationDate()) ?? null,
    },
  };
}

/** Writes the edited properties onto the output document. */
export function applyMetadata(doc: PDFDocument, metadata: PdfMetadata, created: Date | null): void {
  doc.setTitle(metadata.title.trim(), { showInWindowTitleBar: metadata.title.trim() !== "" });
  doc.setAuthor(metadata.author.trim());
  doc.setSubject(metadata.subject.trim());
  // Stored as typed: pdf-lib would otherwise join a list with spaces and lose the commas.
  const keywords = metadata.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .join(", ");
  doc.setKeywords(keywords ? [keywords] : []);
  doc.setProducer("Sky Tools PDF Studio");
  doc.setCreator("Sky Tools PDF Studio");
  if (created) doc.setCreationDate(created);
  doc.setModificationDate(new Date());
}
