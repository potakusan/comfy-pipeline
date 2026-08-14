"use client";
import { useState } from "react";
import { type BatchPreset, type BatchPresetSet } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Layers, Plus, Play, Pencil, Trash2, Copy, GripVertical } from "lucide-react";
import { useDragReorder } from "@/hooks/pipeline/use-drag-reorder";

const totalImages = (presets: BatchPreset[]) =>
  presets.reduce((s, p) => s + p.batchCount, 0);

// ---------------------------------------------------------------------------
// Set card (draggable for reorder)
// ---------------------------------------------------------------------------

interface SetCardProps {
  set: BatchPresetSet;
  index: number;
  checked: boolean;
  onToggleCheck: () => void;
  confirmDelete: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onRun: () => void;
  onReorder: (from: number, to: number) => void;
}

function SetCard({
  set,
  index,
  checked,
  onToggleCheck,
  confirmDelete,
  onEdit,
  onDuplicate,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onRun,
  onReorder,
}: SetCardProps) {
  const { isOver, ...dragHandlers } = useDragReorder(index, onReorder);

  return (
    <div
      {...dragHandlers}
      className={`rounded-lg border bg-card p-3 transition-colors ${
        checked ? "border-primary bg-primary/5" : ""
      } ${isOver ? "border-blue-400 opacity-60" : ""}`}
    >
      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-start gap-2">
        <GripVertical className="mt-1 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 active:cursor-grabbing" />
        <Checkbox
          checked={checked}
          onCheckedChange={onToggleCheck}
          className="mt-1 h-3.5 w-3.5 shrink-0"
        />
        <div className="overflow-hidden">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium">
              {set.name}
            </p>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {set.presets.length}プリセット
            </Badge>
            {set.presets.length > 0 && (
              <Badge variant="outline" className="shrink-0 text-[10px]">
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
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
            編集
          </Button>
          {confirmDelete ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={onConfirmDelete}
              >
                削除確認
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onCancelDelete}
              >
                戻る
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-muted-foreground hover:text-foreground"
                title="複製"
                onClick={onDuplicate}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-muted-foreground hover:text-destructive"
                onClick={onRequestDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={set.presets.length === 0}
                onClick={onRun}
              >
                <Play className="h-3 w-3" />
                実行
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ListViewProps {
  batchPresetSets: BatchPresetSet[];
  onEditSet: (set: BatchPresetSet) => void;
  onRemoveSet: (id: string) => void;
  onReorderSets: (from: number, to: number) => void;
  onDuplicateSet: (id: string) => void;
  onRunSetup: (set: BatchPresetSet) => void;
  onBulkRunSetup: (sets: BatchPresetSet[]) => void;
  onCreateNew: () => void;
}

export default function ListView({
  batchPresetSets,
  onEditSet,
  onRemoveSet,
  onReorderSets,
  onDuplicateSet,
  onRunSetup,
  onBulkRunSetup,
  onCreateNew,
}: ListViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkedSets = batchPresetSets.filter((s) => checkedIds.has(s.id));

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
            {batchPresetSets.map((set, index) => (
              <SetCard
                key={set.id}
                set={set}
                index={index}
                checked={checkedIds.has(set.id)}
                onToggleCheck={() => toggleChecked(set.id)}
                confirmDelete={confirmDeleteId === set.id}
                onEdit={() => onEditSet(set)}
                onDuplicate={() => onDuplicateSet(set.id)}
                onRequestDelete={() => setConfirmDeleteId(set.id)}
                onConfirmDelete={() => {
                  onRemoveSet(set.id);
                  setConfirmDeleteId(null);
                }}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onRun={() => onRunSetup(set)}
                onReorder={onReorderSets}
              />
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 flex gap-2 border-t px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={onCreateNew}
        >
          <Plus className="h-3.5 w-3.5" />
          新しいセットを作成
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          disabled={checkedSets.length === 0}
          onClick={() => onBulkRunSetup(checkedSets)}
        >
          <Play className="h-3.5 w-3.5" />
          選択した{checkedSets.length}件を一括実行
        </Button>
      </div>
    </div>
  );
}
