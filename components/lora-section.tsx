"use client";
import type { LoraEntry } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import LoraFields, { EMPTY_LORA } from "@/components/lora-fields";

export function LoraSection({
  lora,
  onChange,
}: {
  lora: LoraEntry | undefined;
  onChange: (lora: LoraEntry | undefined) => void;
}) {
  const draft = lora ?? EMPTY_LORA;

  return (
    <>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">LoRA（任意）</Label>
        {lora ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 gap-1 text-xs text-muted-foreground"
            onClick={() => onChange(undefined)}
          >
            <X className="h-3 w-3" />
            解除
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-5 gap-1 text-xs"
            onClick={() => onChange({ ...EMPTY_LORA })}
          >
            <Plus className="h-3 w-3" />
            LoRAを紐付け
          </Button>
        )}
      </div>
      {lora && (
        <div className="space-y-2 rounded-md border p-2">
          <LoraFields draft={draft} onChange={onChange} compact />
        </div>
      )}
    </>
  );
}
