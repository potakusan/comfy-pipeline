"use client";
import { Badge } from "@/components/ui/badge";
import { Grid2x2, Sprout } from "lucide-react";
import type { GalleryFolderInfo } from "@/lib/gallery";

function thumbUrl(path: string) {
  return `/api/comfy/output/thumbnail?path=${encodeURIComponent(path)}`;
}

export default function GalleryFolderList({
  folders,
  selectedFolder,
  onSelect,
}: {
  folders: GalleryFolderInfo[];
  selectedFolder: string | null;
  onSelect: (folder: string) => void;
}) {
  if (folders.length === 0) {
    return (
      <p className="p-3 text-center text-xs text-muted-foreground">
        フォルダがありません
      </p>
    );
  }

  return (
    <div className="h-full min-h-0 flex-1 overflow-y-auto p-2 flex flex-col gap-1">
      {folders.map((f) => (
        <div
          key={f.name}
          className={`flex items-center gap-2 rounded-lg border p-1.5 transition-colors ${
            selectedFolder === f.name
              ? "border-primary bg-primary/10"
              : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
          }`}
        >
          <button
            onClick={() => onSelect(f.name)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted/30">
              {f.firstImage && (
                <img
                  src={thumbUrl(f.firstImage)}
                  alt={f.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[11px]">{f.name}</p>
              <div className="mt-0.5 flex items-center gap-1">
                <Badge variant="outline" className="text-[9px]">
                  {f.count}枚
                </Badge>
                {f.releaseCount > 0 && (
                  <Badge className="text-[9px]" variant="secondary">
                    販売用 {f.releaseCount}
                  </Badge>
                )}
                {f.mosaicCount > 0 && (
                  <Badge className="gap-0.5 text-[9px]" variant="secondary">
                    <Grid2x2 className="h-2.5 w-2.5" />
                    {f.mosaicCount}
                  </Badge>
                )}
              </div>
            </div>
          </button>
          {f.releaseCount > 0 && (
            <a
              href={`/?seedSourceFolder=${encodeURIComponent(f.name)}`}
              title="このフォルダの販売用選択画像のシードを引き継いで一括キューを実行"
              aria-label="このフォルダの販売用選択画像のシードを引き継いで一括キューを実行"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Sprout className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
