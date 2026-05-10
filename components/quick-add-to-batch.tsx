"use client";
import { useState } from "react";
import { type BatchPreset, type BatchPresetSet } from "@/lib/comfy";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus, Check } from "lucide-react";
import { toast } from "sonner";

interface QuickAddToBatchProps {
  batchPresetSets: BatchPresetSet[];
  onCaptureCurrentSettings: (name?: string) => BatchPreset;
  onSaveSet: (set: BatchPresetSet) => void;
}

export default function QuickAddToBatch({
  batchPresetSets,
  onCaptureCurrentSettings,
  onSaveSet,
}: QuickAddToBatchProps) {
  const [flashId, setFlashId] = useState<string | null>(null);

  function flash(id: string) {
    setFlashId(id);
    setTimeout(() => setFlashId(null), 1200);
  }

  function addToSet(set: BatchPresetSet) {
    const preset = onCaptureCurrentSettings();
    onSaveSet({ ...set, presets: [...set.presets, preset] });
    flash(set.id);
    toast.success(`「${set.name}」に追加しました`, {
      description: preset.name,
      duration: 2000,
    });
  }

  function createNewSetAndAdd() {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const newSet: BatchPresetSet = {
      id: crypto.randomUUID(),
      name: `セット ${timeStr}`,
      presets: [],
    };
    const preset = onCaptureCurrentSettings();
    newSet.presets = [preset];
    onSaveSet(newSet);
    flash(newSet.id);
    toast.success(`新しいセットを作成しました`, {
      description: `${newSet.name} · ${preset.name}`,
      duration: 2000,
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 px-2 text-xs"
          title="現在の設定を一括キューに素早く追加"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {batchPresetSets.length > 0 && (
          <>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
              セットに追加
            </p>
            {batchPresetSets.map((set) => (
              <DropdownMenuItem
                key={set.id}
                onClick={() => addToSet(set)}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0 truncate">{set.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {flashId === set.id ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    `${set.presets.length}件`
                  )}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={createNewSetAndAdd}
          className="gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          新しいセットを作成して追加
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
