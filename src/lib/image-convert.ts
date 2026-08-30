export type ImageOutputFormat = "image/png" | "image/jpeg" | "image/webp";

export const OUTPUT_FORMATS: { value: ImageOutputFormat; label: string; ext: string }[] = [
  { value: "image/png", label: "PNG", ext: "png" },
  { value: "image/jpeg", label: "JPG", ext: "jpg" },
  { value: "image/webp", label: "WebP", ext: "webp" },
];

export function supportsQuality(format: ImageOutputFormat): boolean {
  return format !== "image/png";
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read "${file.name}" as an image.`));
    };
    img.src = url;
  });
}

export async function convertImage(
  file: File,
  format: ImageOutputFormat,
  quality: number,
): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  if (format === "image/jpeg") {
    // JPEG has no alpha channel — flatten onto white first.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Could not convert "${file.name}".`));
      },
      format,
      supportsQuality(format) ? quality : undefined,
    );
  });
}

export function baseName(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}
