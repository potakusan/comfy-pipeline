"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TAG_CATEGORIES, DEFAULT_INCLUDE_CATEGORIES, type DatasetInfo, type TagCategory } from "@/lib/lora-dataset/types";

const CATEGORY_LABELS: Record<TagCategory, string> = {
  general: "一般",
  character: "キャラクター",
  copyright: "作品名",
  artist: "絵師",
  meta: "メタ",
};

interface DatasetFormInput {
  name: string;
  repeat: number;
  triggerWord: string;
  includeCategories: TagCategory[];
}

interface Props {
  datasets: DatasetInfo[];
  selectedFolder: string | null;
  onSelect: (folder: string) => void;
  onCreate: (input: DatasetFormInput) => Promise<string | null>;
  onUpdate: (folder: string, input: DatasetFormInput) => Promise<string | null>;
  onDelete: (folder: string) => void;
}

export default function DatasetSidebar({ datasets, selectedFolder, onSelect, onCreate, onUpdate, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [repeat, setRepeat] = useState(10);
  const [triggerWord, setTriggerWord] = useState("");
  const [categories, setCategories] = useState<TagCategory[]>(DEFAULT_INCLUDE_CATEGORIES);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleCategory = (c: TagCategory) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const openCreate = () => {
    setEditingFolder(null);
    setName("");
    setRepeat(10);
    setTriggerWord("");
    setCategories(DEFAULT_INCLUDE_CATEGORIES);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (d: DatasetInfo) => {
    setEditingFolder(d.folder);
    setName(d.name);
    setRepeat(d.repeat);
    setTriggerWord(d.triggerWord);
    setCategories(d.includeCategories);
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const input: DatasetFormInput = { name, repeat, triggerWord, includeCategories: categories };
    const err = editingFolder ? await onUpdate(editingFolder, input) : await onCreate(input);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setDialogOpen(false);
  };

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2 border-r p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          データセット
        </p>
        <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={openCreate}>
          <Plus className="h-3 w-3" />
          新規
        </Button>
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto">
        {datasets.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">データセットがありません</p>
        )}
        {datasets.map((d) => (
          <div
            key={d.folder}
            className={cn(
              "group flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-accent",
              selectedFolder === d.folder && "bg-accent",
            )}
          >
            <button className="flex-1 truncate text-left" onClick={() => onSelect(d.folder)}>
              <span className="font-medium">{d.name}</span>
              <span className="ml-1 text-muted-foreground">
                ({d.repeat}回 / {d.imageCount}枚)
              </span>
            </button>
            <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => openEdit(d)}
                aria-label="編集"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(d.folder)}
                aria-label="削除"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFolder ? "データセットを編集" : "新規データセット"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">名前</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mychar" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">繰り返し回数 (repeat)</Label>
              <Input
                type="number"
                min={1}
                value={repeat}
                onChange={(e) => setRepeat(Number(e.target.value) || 1)}
              />
              {editingFolder && (
                <p className="text-[10px] text-muted-foreground">
                  小規模データセットでrepeatを高くしすぎると過学習しやすくなります
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">トリガーワード</Label>
              <Input value={triggerWord} onChange={(e) => setTriggerWord(e.target.value)} placeholder="mychar" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">キャプションに含めるタグカテゴリ</Label>
              <div className="flex flex-wrap gap-3">
                {TAG_CATEGORIES.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-xs">
                    <Checkbox checked={categories.includes(c)} onCheckedChange={() => toggleCategory(c)} />
                    {CATEGORY_LABELS[c]}
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {editingFolder ? "保存" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
