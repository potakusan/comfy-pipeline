"use client";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatasetImageEntry } from "@/lib/lora-dataset/types";

interface Props {
  folder: string;
  images: DatasetImageEntry[];
  /** id -> このデータセットでの最終タグ集合（captionTags）。ホバー中のタグによる薄暗め判定に使う。 */
  imageTags: Map<number, Set<string>>;
  hoveredTag: string | null;
  selectionMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpen: (image: DatasetImageEntry) => void;
  onDelete: (image: DatasetImageEntry) => void;
}

export default function DatasetImageGrid({
  folder,
  images,
  imageTags,
  hoveredTag,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onOpen,
  onDelete,
}: Props) {
  if (images.length === 0) {
    return <p className="p-4 text-center text-xs text-muted-foreground">条件に一致する画像がありません</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-2 overflow-y-auto p-3 sm:grid-cols-6 lg:grid-cols-8">
      {images.map((image) => {
        const dimmed = !!hoveredTag && !imageTags.get(image.id)?.has(hoveredTag);
        const selected = selectedIds.has(image.id);
        return (
          <div
            key={image.id}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-md border bg-muted transition-opacity",
              dimmed && "opacity-70",
              selectionMode && selected && "ring-2 ring-primary",
            )}
          >
            <button
              className="h-full w-full"
              onClick={() => (selectionMode ? onToggleSelect(image.id) : onOpen(image))}
              title={selectionMode ? `#${image.id} を選択` : `#${image.id} を編集`}
            >
              <img
                src={`/api/lora-dataset/raw?folder=${encodeURIComponent(folder)}&id=${image.id}`}
                alt={`#${image.id}`}
                className={cn("h-full w-full object-cover", selectionMode && selected && "opacity-80")}
              />
            </button>
            {selectionMode ? (
              <div className="absolute top-1 left-1 rounded-full bg-black/60 p-0.5 text-white">
                {selected ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
            ) : (
              <button
                className="absolute top-1 right-1 hidden rounded bg-black/60 p-1 text-white group-hover:block"
                onClick={() => onDelete(image)}
                aria-label="削除"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
