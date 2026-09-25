"use client";

import { useState } from "react";

/** Click-or-drop file picker used by the file-based tools. */
export default function FileDropZone({
  title,
  hint,
  accept,
  multiple = true,
  onFiles,
}: {
  title: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-background-raised px-6 py-12 text-center transition hover:border-accent ${
        dragging ? "border-accent bg-accent-soft" : "border-border"
      }`}
    >
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-muted">{hint}</span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Reset so choosing the same file again still fires onChange.
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
        className="hidden"
      />
    </label>
  );
}
