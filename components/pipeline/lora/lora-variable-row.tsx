import { type DragEvent } from "react";
import { type LoraEntry } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Pencil, GripVertical } from "lucide-react";

export interface VariableLoraRowProps {
  lora: LoraEntry;
  isSelected: boolean;
  /** false = 選択トグルを無効化しラジオ表示も出さない（アーカイブ内の行用） */
  selectable?: boolean;
  onSelect?: () => void;
  onEdit: () => void;
  dragHandlers?: {
    draggable: true;
    onDragStart: (e: DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
  };
  extraClassName?: string;
  trailing?: React.ReactNode;
}

export default function VariableLoraRow({
  lora,
  isSelected,
  selectable = true,
  onSelect,
  onEdit,
  dragHandlers,
  extraClassName,
  trailing,
}: VariableLoraRowProps) {
  const info = (
    <div className="min-w-0 flex-1 text-left">
      <p
        className="flex items-center gap-1 truncate font-mono text-xs font-medium"
        title={lora.name}
      >
        {lora.isPromptOnly && (
          <Badge variant="outline" className="shrink-0 text-[9px]">
            プロンプトのみ
          </Badge>
        )}
        <span className="truncate">{lora.name || "(名前未設定)"}</span>
      </p>
      <p className="text-[10px] text-muted-foreground">
        {lora.isPromptOnly
          ? "LoRA未適用"
          : `str: ${lora.strength} / clip: ${lora.clipStrength}`}
        {lora.triggerWords && (
          <span className="ml-1 italic">
            · {lora.triggerWords.substring(0, 20)}
            {lora.triggerWords.length > 20 ? "..." : ""}
          </span>
        )}
      </p>
    </div>
  );

  return (
    <div
      {...dragHandlers}
      className={`flex min-w-0 items-center gap-1.5 overflow-hidden rounded-md border transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
          : "border-border"
      } ${extraClassName ?? ""}`}
    >
      {dragHandlers && (
        <GripVertical className="ml-1.5 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 active:cursor-grabbing" />
      )}
      {selectable ? (
        <button
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2"
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              isSelected
                ? "border-blue-500 bg-blue-500"
                : "border-muted-foreground"
            }`}
          >
            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
          </span>
          {info}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2">
          {info}
        </div>
      )}

      {trailing}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onEdit}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );
}
