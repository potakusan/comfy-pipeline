"use client";
import { useState } from "react";
import { type BatchPreset, type BatchPresetSet } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus, Play, Pencil, Trash2 } from "lucide-react";

const totalImages = (presets: BatchPreset[]) =>
  presets.reduce((s, p) => s + p.batchCount, 0);

interface ListViewProps {
  batchPresetSets: BatchPresetSet[];
  onEditSet: (set: BatchPresetSet) => void;
  onRemoveSet: (id: string) => void;
  onRunSetup: (set: BatchPresetSet) => void;
  onCreateNew: () => void;
}

export default function ListView({
  batchPresetSets,
  onEditSet,
  onRemoveSet,
  onRunSetup,
  onCreateNew,
}: ListViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {batchPresetSets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Layers className="h-10 w-10 opacity-20" />
            <p className="text-xs">プリセットセットがありません</p>
            <p className="text-[11px]">
              「新しいセットを作成」から始めましょう
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {batchPresetSets.map((set) => (
              <div key={set.id} className="rounded-lg border bg-card p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-medium">
                        {set.name}
                      </p>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px]"
                      >
                        {set.presets.length}プリセット
                      </Badge>
                      {set.presets.length > 0 && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
                          計{totalImages(set.presets)}枚
                        </Badge>
                      )}
                    </div>
                    {set.presets.length > 0 && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {set.presets.map((p) => p.name).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => onEditSet(set)}
                    >
                      <Pencil className="h-3 w-3" />
                      編集
                    </Button>
                    {confirmDeleteId === set.id ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            onRemoveSet(set.id);
                            setConfirmDeleteId(null);
                          }}
                        >
                          削除確認
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          戻る
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDeleteId(set.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          disabled={set.presets.length === 0}
                          onClick={() => onRunSetup(set)}
                        >
                          <Play className="h-3 w-3" />
                          実行
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={onCreateNew}
        >
          <Plus className="h-3.5 w-3.5" />
          新しいセットを作成
        </Button>
      </div>
    </div>
  );
}
