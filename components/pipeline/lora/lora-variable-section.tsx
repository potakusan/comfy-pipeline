"use client";
import { useState } from "react";
import { type LoraEntry } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Archive, ArchiveRestore, ChevronDown } from "lucide-react";
import VariableLoraRow from "@/components/pipeline/lora/lora-variable-row";

export default function LoraVariableSection({
  variableLoras,
  selectedVariableLora,
  onSelect,
  onAdd,
  onEdit,
  onArchive,
}: {
  variableLoras: LoraEntry[];
  selectedVariableLora: LoraEntry | null;
  onSelect: (lora: LoraEntry | null) => void;
  onAdd: () => void;
  onEdit: (lora: LoraEntry, index: number) => void;
  onArchive: (index: number, archived: boolean) => void;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveDragOver, setArchiveDragOver] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const indexed = variableLoras.map((lora, i) => ({ lora, i }));
  const activeVariableLoras = indexed.filter(({ lora }) => !lora.isArchived);
  const archivedVariableLoras = indexed.filter(({ lora }) => lora.isArchived);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          可変LoRA
        </p>
        <Button variant="default" size="sm" className="h-6 gap-1 text-xs" onClick={onAdd}>
          <Plus className="h-3 w-3" />
          追加
        </Button>
      </div>

      {variableLoras.length === 0 ? (
        <button
          onClick={onAdd}
          className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center hover:border-muted-foreground/50 hover:bg-muted/30"
        >
          <Plus className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            「追加」ボタンまたはここをクリックして
            <br />
            可変LoRAを登録
          </span>
        </button>
      ) : (
        <div className="space-y-1.5">
          <button
            onClick={() => onSelect(null)}
            className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
              !selectedVariableLora
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                !selectedVariableLora
                  ? "border-blue-500 bg-blue-500"
                  : "border-muted-foreground"
              }`}
            >
              {!selectedVariableLora && (
                <Check className="h-2.5 w-2.5 text-white" />
              )}
            </span>
            <span className="text-muted-foreground">
              なし（固定LoRAのみ）
            </span>
          </button>

          {activeVariableLoras.length === 0 ? (
            <p className="px-1 py-1 text-[10px] text-muted-foreground">
              有効な可変LoRAはありません（アーカイブを確認）
            </p>
          ) : (
            activeVariableLoras.map(({ lora, i }) => (
              <VariableLoraRow
                key={i}
                lora={lora}
                isSelected={selectedVariableLora?.name === lora.name}
                onSelect={() =>
                  onSelect(selectedVariableLora?.name === lora.name ? null : lora)
                }
                onEdit={() => onEdit(lora, i)}
                extraClassName={draggingIndex === i ? "opacity-40" : ""}
                dragHandlers={{
                  draggable: true,
                  onDragStart: (e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(i));
                    setDraggingIndex(i);
                  },
                  onDragEnd: () => setDraggingIndex(null),
                }}
              />
            ))
          )}
        </div>
      )}

      {/* アーカイブ（開閉可能・D&Dで追加） */}
      {variableLoras.length > 0 && (
        <div
          className={`mt-2 rounded-md border border-dashed transition-colors ${
            archiveDragOver
              ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
              : "border-border"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setArchiveDragOver(true);
          }}
          onDragLeave={() => setArchiveDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArchiveDragOver(false);
            const from = Number(e.dataTransfer.getData("text/plain"));
            if (!isNaN(from)) onArchive(from, true);
          }}
        >
          <button
            onClick={() => setArchiveOpen((v) => !v)}
            className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                archiveOpen ? "" : "-rotate-90"
              }`}
            />
            <Archive className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">アーカイブ</span>
            {archivedVariableLoras.length > 0 && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {archivedVariableLoras.length}
              </Badge>
            )}
          </button>

          {archiveOpen && (
            <div className="space-y-1.5 border-t px-2 py-2">
              {archivedVariableLoras.length === 0 ? (
                <p className="py-1 text-[10px] text-muted-foreground">
                  可変LoRAをここにドラッグ&ドロップするとアーカイブされます
                </p>
              ) : (
                archivedVariableLoras.map(({ lora, i }) => (
                  <VariableLoraRow
                    key={i}
                    lora={lora}
                    isSelected={false}
                    selectable={false}
                    onEdit={() => onEdit(lora, i)}
                    extraClassName="opacity-70"
                    trailing={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        title="アーカイブから戻す"
                        onClick={() => onArchive(i, false)}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
