import { type LoraEntry } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";

export default function LoraFixedSection({
  fixedLoras,
  onAdd,
  onEdit,
}: {
  fixedLoras: LoraEntry[];
  onAdd: () => void;
  onEdit: (lora: LoraEntry, index: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          固定LoRA（常時適用）
        </p>
        <Button variant="default" size="sm" className="h-6 gap-1 text-xs" onClick={onAdd}>
          <Plus className="h-3 w-3" />
          追加
        </Button>
      </div>

      {fixedLoras.length === 0 ? (
        <button
          onClick={onAdd}
          className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-3 text-center hover:border-muted-foreground/50 hover:bg-muted/30"
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            固定LoRAを追加
          </span>
        </button>
      ) : (
        <div className="space-y-1">
          {fixedLoras.map((lora, i) => (
            <div
              key={i}
              className="flex min-w-0 items-center gap-1.5 overflow-hidden rounded-md border bg-muted/30 px-2 py-1.5"
            >
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                固定
              </Badge>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-mono text-[10px] font-medium"
                  title={lora.name}
                >
                  {lora.name || "(名前未設定)"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  str: {lora.strength} / clip: {lora.clipStrength}
                  {lora.triggerWords && (
                    <span className="ml-1 italic">
                      · {lora.triggerWords.substring(0, 18)}
                      {lora.triggerWords.length > 18 ? "..." : ""}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => onEdit(lora, i)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
