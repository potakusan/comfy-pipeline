"use client";
import { useState } from "react";
import type { Preset, LoraEntry, PresetCategory } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { LoraSection } from "@/components/lora-section";
import TagAutocompleteTextarea from "@/components/tag-autocomplete-textarea";
import { Pencil, Trash2 } from "lucide-react";

export type PresetType = "physical" | "count" | "pose" | "scene" | "other";

export const TYPE_LABELS: Record<PresetType, string> = {
  physical: "身体的特徴",
  count: "人数",
  pose: "ポーズ",
  scene: "シーン",
  other: "その他",
};

// ---------------------------------------------------------------------------
// Category manager modal
// ---------------------------------------------------------------------------

export function CategoryManagerModal({
  open,
  onOpenChange,
  categories,
  onAdd,
  onRename,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: PresetCategory[];
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const commitRename = (id: string) => {
    if (editDraft.trim()) onRename(id, editDraft.trim());
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">カテゴリ管理</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          {categories.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              カテゴリがありません
            </p>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1">
              {editingId === cat.id ? (
                <>
                  <Input
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="h-6 flex-1 text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(cat.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-6 text-xs"
                    disabled={!editDraft.trim()}
                    onClick={() => commitRename(cat.id)}
                  >
                    保存
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setEditingId(null)}
                  >
                    ×
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-xs">{cat.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditDraft(cat.name);
                      setConfirmDeleteId(null);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {confirmDeleteId === cat.id ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          onRemove(cat.id);
                          setConfirmDeleteId(null);
                        }}
                      >
                        削除
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        ×
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setConfirmDeleteId(cat.id);
                        setEditingId(null);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Add new */}
          <div className="flex gap-2 pt-1">
            <Input
              placeholder="新しいカテゴリ名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-7 flex-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onAdd(newName.trim());
                  setNewName("");
                }
              }}
            />
            <Button
              size="sm"
              className="h-7"
              disabled={!newName.trim()}
              onClick={() => {
                onAdd(newName.trim());
                setNewName("");
              }}
            >
              追加
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Preset edit/add modal
// ---------------------------------------------------------------------------

interface PresetModalProps {
  open: boolean;
  preset: Preset | null;
  type: PresetType;
  categories: PresetCategory[];
  onClose: () => void;
  onSave: (updates: {
    name: string;
    prompt: string;
    lora?: LoraEntry;
    promptMode: "all" | "random";
    category?: string;
  }) => void;
  onDelete?: () => void;
}

export function PresetModal({
  open,
  preset,
  type,
  categories,
  onClose,
  onSave,
  onDelete,
}: PresetModalProps) {
  const [name, setName] = useState(preset?.name ?? "");
  const [prompt, setPrompt] = useState(preset?.prompt ?? "");
  const [lora, setLora] = useState<LoraEntry | undefined>(preset?.lora);
  const [promptMode, setPromptMode] = useState<"all" | "random">(
    preset?.promptMode ?? "all",
  );
  const [category, setCategory] = useState<string>(preset?.category ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setConfirmDelete(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {!preset ? `${TYPE_LABELS[type]}プリセット追加` : "プリセット編集"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 text-xs">名前</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="プリセット名"
              className="text-sm"
              autoFocus
            />
          </div>

          {categories.length > 0 && (
            <div>
              <Label className="mb-1 text-xs">カテゴリ</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">未分類</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs">プロンプト</Label>
              <div className="flex items-center gap-1.5">
                {(["all", "random"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPromptMode(m)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border transition-colors ${
                      promptMode === m
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full border ${promptMode === m ? "border-primary-foreground bg-primary-foreground" : "border-muted-foreground"}`}
                    />
                    {m === "all" ? "全行使用" : "ランダム1行"}
                  </button>
                ))}
              </div>
            </div>
            <TagAutocompleteTextarea
              value={prompt}
              onChange={setPrompt}
              placeholder={
                promptMode === "random"
                  ? "1行1タグで入力。生成ごとにランダムで1行が使われます。"
                  : "プロンプトを入力（日本語/英語でタグ補完が使えます）"
              }
              style={{ minHeight: "100px" }}
            />
            {promptMode === "random" && prompt.trim() && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {prompt.split("\n").filter((s) => s.trim()).length}行 —
                生成ごとに1行がランダム選択されます
              </p>
            )}
          </div>
          <LoraSection lora={lora} onChange={setLora} />
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
            disabled={!name.trim()}
            onClick={() => {
              onSave({
                name: name.trim(),
                prompt,
                lora,
                promptMode,
                category: category || undefined,
              });
              onClose();
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
