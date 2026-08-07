"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle } from "lucide-react";
import type { SavedImage } from "@/components/composition-dialog";

export default function SavedImageCard({
  img,
  onApply,
  onDelete,
  onEdit,
  isApplied,
  isEditing,
}: {
  img: SavedImage;
  onApply: (img: SavedImage) => void;
  onDelete: (id: string) => void;
  onEdit: (img: SavedImage) => void;
  isApplied: boolean;
  isEditing: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col gap-1 rounded-md border p-1.5 transition-colors ${
        isEditing
          ? "border-amber-400 bg-amber-500/10 ring-1 ring-amber-400"
          : isApplied
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
      }`}
    >
      {isApplied && !isEditing && (
        <CheckCircle className="absolute right-1 top-1 h-3.5 w-3.5 text-primary" />
      )}
      {isEditing && (
        <span className="absolute right-1 top-1 text-[9px] font-bold text-amber-400">
          編集中
        </span>
      )}

      <img
        src={img.thumbnail}
        alt={img.name}
        className="h-20 w-full cursor-pointer rounded object-cover"
        title="ダブルクリックで編集"
        onDoubleClick={() => onEdit(img)}
      />
      <span className="truncate text-[10px] font-medium">{img.name}</span>
      <Badge variant="outline" className="w-fit text-[9px]">
        {img.mode === "pose" ? "ポーズ" : "カラーマップ"}
      </Badge>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 flex-1 text-[10px]"
          onClick={() => onApply(img)}
        >
          適用
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(img.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
