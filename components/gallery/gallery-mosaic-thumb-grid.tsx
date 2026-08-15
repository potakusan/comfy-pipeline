"use client";
import type { GalleryMosaicImageEntry } from "@/lib/gallery";

function thumbUrl(path: string, cacheBust: boolean) {
  const url = `/api/comfy/output/thumbnail?path=${encodeURIComponent(path)}`;
  return cacheBust ? `${url}&t=${Date.now()}` : url;
}

export default function GalleryMosaicThumbGrid({
  images,
  selectedPath,
  onSelect,
  justSavedPath,
}: {
  images: GalleryMosaicImageEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** just-overwritten path — forces a fresh thumbnail fetch past the browser's HTTP cache */
  justSavedPath?: string | null;
}) {
  if (images.length === 0) {
    return (
      <p className="p-3 text-center text-xs text-muted-foreground">
        モザイク処理済みの画像がありません
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 overflow-y-auto p-2">
      {images.map((entry) => (
        <button
          key={entry.path}
          onClick={() => onSelect(entry.path)}
          className={`overflow-hidden rounded border bg-muted/20 transition-all ${
            selectedPath === entry.path
              ? "border-primary ring-1 ring-primary"
              : "border-border hover:border-muted-foreground/50"
          }`}
        >
          <img
            src={thumbUrl(entry.path, entry.path === justSavedPath)}
            alt={entry.filename}
            className="aspect-3/4 w-full object-cover"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}
