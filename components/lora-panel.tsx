"use client";
import { useState } from "react";
import { type LoraEntry } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import TagAutocompleteTextarea from "@/components/tag-autocomplete-textarea";
import { Plus, Trash2, Pencil, Check, Library } from "lucide-react";
import {
  LoraPickerDialog,
  type LmLoraItem,
} from "@/components/lora-picker-dialog";
import { FIXED_LORAS } from "@/lib/config";

interface LoraPanelProps {
  variableLoras: LoraEntry[];
  selectedVariableLora: LoraEntry | null;
  onSelectVariableLora: (lora: LoraEntry | null) => void;
  onAddVariableLora: (lora: LoraEntry) => void;
  onUpdateVariableLora: (index: number, lora: LoraEntry) => void;
  onRemoveVariableLora: (index: number) => void;
}

const EMPTY_LORA: LoraEntry = {
  name: "",
  strength: 1.0,
  clipStrength: 1.0,
  triggerWords: "",
};

// --- LoRA Edit Modal ---
interface LoraModalProps {
  open: boolean;
  lora: LoraEntry | null; // null = add new
  onClose: () => void;
  onSave: (lora: LoraEntry) => void;
  onDelete?: () => void;
}

function LoraModal({ open, lora, onClose, onSave, onDelete }: LoraModalProps) {
  const [draft, setDraft] = useState<LoraEntry>(lora ?? { ...EMPTY_LORA });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isNew = !lora;

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setConfirmDelete(false);
      onClose();
    } else {
      setDraft(lora ?? { ...EMPTY_LORA });
    }
  };

  const set = <K extends keyof LoraEntry>(key: K, val: LoraEntry[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const handlePickerSelect = (item: LmLoraItem) => {
    const triggerWords = item.civitai?.trainedWords?.join("\n") ?? "";
    setDraft((d) => ({ ...d, name: item.file_name, triggerWords }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {isNew ? "可変LoRA追加" : "可変LoRA編集"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-xs">LoRA名（.safetensors不要）</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={() => setPickerOpen(true)}
                >
                  <Library className="h-3 w-3" />
                  一覧から選択
                </Button>
              </div>
              <Input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="例: my_character_lora_v1"
                className="font-mono text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                ComfyUIのmodels/lorasフォルダ内のファイル名を入力
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs">強度</Label>
                  <span className="font-mono text-xs text-muted-foreground">
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
                  <Label className="text-xs">CLIP強度</Label>
                  <span className="font-mono text-xs text-muted-foreground">
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
              <Label className="mb-1 text-xs">
                トリガーワード（プロンプトに自動追加）
              </Label>
              <TagAutocompleteTextarea
                value={draft.triggerWords}
                onChange={(v) => set("triggerWords", v)}
                placeholder="例: my_character, blue hair, cat ears, ..."
                style={{ minHeight: "70px" }}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {onDelete && !confirmDelete && (
              <Button
                variant="outline"
                className="mr-auto text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                削除
              </Button>
            )}
            {confirmDelete && (
              <div className="mr-auto flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onDelete?.();
                    onClose();
                  }}
                >
                  本当に削除
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  キャンセル
                </Button>
              </div>
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

      <LoraPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
      />
    </>
  );
}

export default function LoraPanel({
  variableLoras,
  selectedVariableLora,
  onSelectVariableLora,
  onAddVariableLora,
  onUpdateVariableLora,
  onRemoveVariableLora,
}: LoraPanelProps) {
  const [modalState, setModalState] = useState<{
    open: boolean;
    lora: LoraEntry | null;
    index: number | null;
  }>({ open: false, lora: null, index: null });

  const openAdd = () => setModalState({ open: true, lora: null, index: null });
  const openEdit = (lora: LoraEntry, index: number) =>
    setModalState({ open: true, lora, index });
  const closeModal = () => setModalState((s) => ({ ...s, open: false }));

  const handleSave = (updated: LoraEntry) => {
    if (modalState.index !== null) {
      onUpdateVariableLora(modalState.index, updated);
      if (
        selectedVariableLora?.name === variableLoras[modalState.index]?.name
      ) {
        onSelectVariableLora(updated);
      }
    } else {
      onAddVariableLora(updated);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          固定LoRA（常時適用）
        </p>
        <div className="space-y-1">
          {FIXED_LORAS.map((lora) => (
            <div
              key={lora.name}
              className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs"
            >
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                固定
              </Badge>
              <span
                className="min-w-0 flex-1 truncate font-mono text-[10px]"
                title={lora.name}
              >
                {lora.name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {lora.strength}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            可変LoRA
          </p>
          <Button
            variant="default"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={openAdd}
          >
            <Plus className="h-3 w-3" />
            追加
          </Button>
        </div>

        {variableLoras.length === 0 ? (
          <button
            onClick={openAdd}
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

            {variableLoras.map((lora, i) => (
              <div
                key={i}
                className={`flex min-w-0 items-center gap-1.5 overflow-hidden rounded-md border transition-colors ${
                  selectedVariableLora?.name === lora.name
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-border"
                }`}
              >
                <button
                  onClick={() =>
                    onSelectVariableLora(
                      selectedVariableLora?.name === lora.name ? null : lora,
                    )
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      selectedVariableLora?.name === lora.name
                        ? "border-blue-500 bg-blue-500"
                        : "border-muted-foreground"
                    }`}
                  >
                    {selectedVariableLora?.name === lora.name && (
                      <Check className="h-2.5 w-2.5 text-white" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p
                      className="truncate font-mono text-xs font-medium"
                      title={lora.name}
                    >
                      {lora.name || "(名前未設定)"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      str: {lora.strength} / clip: {lora.clipStrength}
                      {lora.triggerWords && (
                        <span className="ml-1 italic">
                          · {lora.triggerWords.substring(0, 20)}
                          {lora.triggerWords.length > 20 ? "..." : ""}
                        </span>
                      )}
                    </p>
                  </div>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => openEdit(lora, i)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalState.open && (
        <LoraModal
          open={modalState.open}
          lora={modalState.lora}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={
            modalState.index !== null
              ? () => {
                  onRemoveVariableLora(modalState.index!);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
