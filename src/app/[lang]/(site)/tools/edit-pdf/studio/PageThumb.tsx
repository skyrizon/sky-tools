import type { StudioPage } from "@/lib/pdf-studio/types";
import AnnotationShapes from "./AnnotationShapes";

/** A page preview with its rotation and added objects, fitted into a 3:4 box. */
export default function PageThumb({ page, src }: { page: StudioPage; src?: string }) {
  const wide = page.size.w >= page.size.h;
  return (
    <span className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md bg-background">
      <span
        className="relative bg-white shadow-sm transition-transform duration-200"
        style={{
          aspectRatio: `${page.size.w} / ${page.size.h}`,
          width: wide ? "88%" : "auto",
          height: wide ? "auto" : "88%",
          transform: `rotate(${page.rotation}deg)`,
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
        ) : (
          <span className="absolute inset-0 animate-pulse bg-border-soft" />
        )}
        {page.annotations.length > 0 && (
          <svg viewBox={`0 0 ${page.size.w} ${page.size.h}`} className="absolute inset-0 h-full w-full">
            <AnnotationShapes annotations={page.annotations} />
          </svg>
        )}
      </span>
    </span>
  );
}
