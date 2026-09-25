import { zip } from "fflate";

/** Starts a browser download of `blob` as `fileName`. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.click();
  // Give the browser time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Makes names unique by adding -2, -3, ... before the extension. */
function uniqueName(name: string, taken: Set<string>): string {
  let candidate = name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 2; taken.has(candidate); n++) candidate = `${stem}-${n}${ext}`;
  taken.add(candidate);
  return candidate;
}

/**
 * Bundles files into a ZIP. Contents are stored without recompression (level 0)
 * because images and PDFs are already compressed.
 */
export async function zipFiles(files: { name: string; data: Blob }[]): Promise<Blob> {
  const taken = new Set<string>();
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const file of files) {
    entries[uniqueName(file.name, taken)] = [new Uint8Array(await file.data.arrayBuffer()), { level: 0 }];
  }
  const data = await new Promise<Uint8Array>((resolve, reject) =>
    zip(entries, (err, out) => (err ? reject(err) : resolve(out))),
  );
  return new Blob([data as BlobPart], { type: "application/zip" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
