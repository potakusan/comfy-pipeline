"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Check, Pencil } from "lucide-react";
import { type Preset } from "@/lib/comfy";
import { useDragReorder } from "@/hooks/pipeline/use-drag-reorder";

export default function DraggableItem({
  preset,
  index,
  isSelected,
  selectionType,
  onSelect,
  onEdit,
  onReorder,
}: {
  preset: Preset;
  index: number;
  isSelected: boolean;
  selectionType: "radio" | "checkbox";
  onSelect: () => void;
  onEdit: () => void;
  onReorder: (from: number, to: number) => void;
}) {
  const { isOver, ...dragHandlers } = useDragReorder(index, onReorder);

  return (
    <div
      {...dragHandlers}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
          : "border-border hover:border-muted-foreground/50"
      } ${isOver ? "border-blue-400 opacity-60" : ""}`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 active:cursor-grabbing" />
      <button
        onClick={onSelect}
        className={`flex h-4 w-4 shrink-0 items-center justify-center border-2 transition-colors ${
          selectionType === "radio" ? "rounded-full" : "rounded-sm"
        } ${isSelected ? "border-blue-500 bg-blue-500" : "border-muted-foreground"}`}
      >
        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
      </button>
      <span
        className="flex-1 truncate text-xs font-medium cursor-pointer"
        onClick={onSelect}
      >
        {preset.name}
      </span>
      {preset.promptMode === "random" && (
        <Badge
          variant="outline"
          className="shrink-0 text-[9px] cursor-pointer text-muted-foreground"
          onClick={onSelect}
        >
          ランダム
        </Badge>
      )}
      {preset.lora && (
        <Badge
          variant="secondary"
          className="shrink-0 text-[9px] cursor-pointer"
          onClick={onSelect}
        >
          LoRA
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100"
        onClick={onEdit}
      >
        <Pencil className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}
