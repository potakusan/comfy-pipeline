"use client";
import { useState, type DragEvent } from "react";
import { type LoraEntry } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  Archive,
  ArchiveRestore,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import DeleteConfirmDialog from "@/components/common/delete-confirm-dialog";
import LoraFields, { EMPTY_LORA } from "@/components/pipeline/lora/lora-fields";

interface LoraPanelProps {
  // Fixed LoRAs (editable)
  fixedLoras: LoraEntry[];
  onAddFixedLora: (lora: LoraEntry) => void;
  onUpdateFixedLora: (index: number, lora: LoraEntry) => void;
  onRemoveFixedLora: (index: number) => void;
  // Variable LoRAs
  variableLoras: LoraEntry[];
  selectedVariableLora: LoraEntry | null;
  onSelectVariableLora: (lora: LoraEntry | null) => void;
  onAddVariableLora: (lora: LoraEntry) => void;
  onUpdateVariableLora: (index: number, lora: LoraEntry) => void;
  onRemoveVariableLora: (index: number) => void;
  onArchiveVariableLora: (index: number, archived: boolean) => void;
}

// ---------------------------------------------------------------------------
// Shared LoRA Edit Modal
// ---------------------------------------------------------------------------
interface LoraModalProps {
  open: boolean;
  lora: LoraEntry | null; // null = add new
  title?: string;
  /** true の場合、「プロンプトのみ（LoRA無し）」トグルを表示する（可変LoRA用） */
  allowPromptOnly?: boolean;
  /** true の場合、DanbooruポストURLからCharacter/GeneralタグをトリガーワードへインポートするUIを表示する（可変LoRA用） */
  allowDanbooruImport?: boolean;
  onClose: () => void;
  onSave: (lora: LoraEntry) => void;
  onDelete?: () => void;
}

function LoraModal({
  open,
  lora,
  title,
  allowPromptOnly,
  allowDanbooruImport,
  onClose,
  onSave,
  onDelete,
}: LoraModalProps) {
  const [draft, setDraft] = useState<LoraEntry>(lora ?? { ...EMPTY_LORA });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isNew = !lora;

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setConfirmDelete(false);
      onClose();
    } else {
      setDraft(lora ?? { ...EMPTY_LORA });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {title ?? (isNew ? "LoRA追加" : "LoRA編集")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <LoraFields
              draft={draft}
              onChange={setDraft}
              allowPromptOnly={allowPromptOnly}
              allowDanbooruImport={allowDanbooruImport}
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {onDelete && (
              <Button
                variant="outline"
                className="mr-auto text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                削除
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              閉じる
            </Button>
            <Button
              disabled={!draft.name.trim()}
              onClick={() => {
                onSave(draft);
                onClose();
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="このLoRAを削除しますか?"
        onConfirm={() => {
          onDelete?.();
          setConfirmDelete(false);
          onClose();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Variable LoRA row (shared between active list and archive list)
// ---------------------------------------------------------------------------
interface VariableLoraRowProps {
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

function VariableLoraRow({
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

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function LoraPanel({
  fixedLoras,
  onAddFixedLora,
  onUpdateFixedLora,
  onRemoveFixedLora,
  variableLoras,
  selectedVariableLora,
  onSelectVariableLora,
  onAddVariableLora,
  onUpdateVariableLora,
  onRemoveVariableLora,
  onArchiveVariableLora,
}: LoraPanelProps) {
  const [fixedModalState, setFixedModalState] = useState<{
    open: boolean;
    lora: LoraEntry | null;
    index: number | null;
  }>({ open: false, lora: null, index: null });

  const [variableModalState, setVariableModalState] = useState<{
    open: boolean;
    lora: LoraEntry | null;
    index: number | null;
  }>({ open: false, lora: null, index: null });

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveDragOver, setArchiveDragOver] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const indexed = variableLoras.map((lora, i) => ({ lora, i }));
  const activeVariableLoras = indexed.filter(({ lora }) => !lora.isArchived);
  const archivedVariableLoras = indexed.filter(({ lora }) => lora.isArchived);

  const openFixedAdd = () =>
    setFixedModalState({ open: true, lora: null, index: null });
  const openFixedEdit = (lora: LoraEntry, index: number) =>
    setFixedModalState({ open: true, lora, index });
  const closeFixedModal = () =>
    setFixedModalState((s) => ({ ...s, open: false }));

  const openVariableAdd = () =>
    setVariableModalState({ open: true, lora: null, index: null });
  const openVariableEdit = (lora: LoraEntry, index: number) =>
    setVariableModalState({ open: true, lora, index });
  const closeVariableModal = () =>
    setVariableModalState((s) => ({ ...s, open: false }));

  const handleFixedSave = (updated: LoraEntry) => {
    if (fixedModalState.index !== null) {
      onUpdateFixedLora(fixedModalState.index, updated);
    } else {
      onAddFixedLora(updated);
    }
  };

  const handleVariableSave = (updated: LoraEntry) => {
    if (variableModalState.index !== null) {
      onUpdateVariableLora(variableModalState.index, updated);
      if (
        selectedVariableLora?.name === variableLoras[variableModalState.index]?.name
      ) {
        onSelectVariableLora(updated);
      }
    } else {
      onAddVariableLora(updated);
    }
  };

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------------------------ */}
      {/* 固定LoRA                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            固定LoRA（常時適用）
          </p>
          <Button
            variant="default"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={openFixedAdd}
          >
            <Plus className="h-3 w-3" />
            追加
          </Button>
        </div>

        {fixedLoras.length === 0 ? (
          <button
            onClick={openFixedAdd}
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
                  onClick={() => openFixedEdit(lora, i)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* 可変LoRA                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            可変LoRA
          </p>
          <Button
            variant="default"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={openVariableAdd}
          >
            <Plus className="h-3 w-3" />
            追加
          </Button>
        </div>

        {variableLoras.length === 0 ? (
          <button
            onClick={openVariableAdd}
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
              onClick={() => onSelectVariableLora(null)}
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
                    onSelectVariableLora(
                      selectedVariableLora?.name === lora.name ? null : lora,
                    )
                  }
                  onEdit={() => openVariableEdit(lora, i)}
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
              if (!isNaN(from)) onArchiveVariableLora(from, true);
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
                      onEdit={() => openVariableEdit(lora, i)}
                      extraClassName="opacity-70"
                      trailing={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="アーカイブから戻す"
                          onClick={() => onArchiveVariableLora(i, false)}
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

      {/* Fixed LoRA modal */}
      {fixedModalState.open && (
        <LoraModal
          open={fixedModalState.open}
          lora={fixedModalState.lora}
          title={fixedModalState.lora ? "固定LoRA編集" : "固定LoRA追加"}
          onClose={closeFixedModal}
          onSave={handleFixedSave}
          onDelete={
            fixedModalState.index !== null
              ? () => onRemoveFixedLora(fixedModalState.index!)
              : undefined
          }
        />
      )}

      {/* Variable LoRA modal */}
      {variableModalState.open && (
        <LoraModal
          open={variableModalState.open}
          lora={variableModalState.lora}
          title={variableModalState.lora ? "可変LoRA編集" : "可変LoRA追加"}
          allowPromptOnly
          allowDanbooruImport
          onClose={closeVariableModal}
          onSave={handleVariableSave}
          onDelete={
            variableModalState.index !== null
              ? () => {
                  onRemoveVariableLora(variableModalState.index!);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
