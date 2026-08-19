"use client";
import { useState } from "react";
import { type LoraEntry } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import DeleteConfirmDialog from "@/components/common/delete-confirm-dialog";
import LoraFields, { EMPTY_LORA } from "@/components/pipeline/lora/lora-fields";

export interface LoraModalProps {
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

export default function LoraModal({
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
