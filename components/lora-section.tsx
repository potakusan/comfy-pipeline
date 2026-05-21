"use client";
import { useState } from "react";
import type { LoraEntry } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  LoraPickerDialog,
  type LmLoraItem,
} from "@/components/lora-picker-dialog";
import TagAutocompleteTextarea from "@/components/tag-autocomplete-textarea";
import { Plus, X, Library } from "lucide-react";

export const EMPTY_LORA: LoraEntry = {
  name: "",
  strength: 1.0,
  clipStrength: 1.0,
  triggerWords: "",
};

export function LoraSection({
  lora,
  onChange,
}: {
  lora: LoraEntry | undefined;
  onChange: (lora: LoraEntry | undefined) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const draft = lora ?? EMPTY_LORA;
  const set = <K extends keyof LoraEntry>(key: K, val: LoraEntry[K]) =>
    onChange({ ...draft, [key]: val });
  const handlePick = (item: LmLoraItem) => {
    const triggerWords = item.civitai?.trainedWords?.join("\n") ?? "";
    onChange({ ...draft, name: item.file_name, triggerWords });
  };

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
          <div className="flex items-center gap-2">
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="LoRAファイル名"
              className="h-7 flex-1 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1 text-xs"
              onClick={() => setPickerOpen(true)}
            >
              <Library className="h-3 w-3" />
              選択
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-[10px]">強度</Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {draft.strength.toFixed(2)}
                </span>
              </div>
              <Slider
                min={0}
                max={2}
                step={0.05}
                value={[draft.strength]}
                onValueChange={([v]) => set("strength", v)}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-[10px]">CLIP強度</Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {draft.clipStrength.toFixed(2)}
                </span>
              </div>
              <Slider
                min={0}
                max={2}
                step={0.05}
                value={[draft.clipStrength]}
                onValueChange={([v]) => set("clipStrength", v)}
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 text-[10px]">トリガーワード</Label>
            <TagAutocompleteTextarea
              value={draft.triggerWords}
              onChange={(v) => set("triggerWords", v)}
              placeholder="例: character_name, blue hair, ..."
              style={{ minHeight: "50px" }}
            />
          </div>
        </div>
      )}
      <LoraPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePick}
      />
    </>
  );
}
