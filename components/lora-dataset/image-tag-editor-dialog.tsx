"use client";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Loader2 } from "lucide-react";
import { useTagDatabase } from "@/hooks/use-tag-database";
import { apiFetch } from "@/lib/api-client";
import { captionTags, formatTag, reconcileTagLists } from "@/lib/lora-dataset/caption-format";
import type { DatasetImageEntry, DatasetMeta } from "@/lib/lora-dataset/types";

interface Props {
  folder: string;
  dataset: DatasetMeta;
  image: DatasetImageEntry | null;
  /** データセット内の各タグの出現件数（page.tsxで集計済みのもの）。チップの (n of m) 表示に使う。 */
  tagCounts: { tag: string; count: number }[];
  totalImages: number;
  onClose: () => void;
  onSaved: (image: DatasetImageEntry) => void;
}

export default function ImageTagEditorDialog({
  folder,
  dataset,
  image,
  tagCounts,
  totalImages,
  onClose,
  onSaved,
}: Props) {
  const { search } = useTagDatabase();
  const tagCountMap = useMemo(() => new Map(tagCounts.map((t) => [t.tag, t.count])), [tagCounts]);
  const [removedTags, setRemovedTags] = useState<string[]>([]);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [sortMode, setSortMode] = useState<"name" | "count">("name");

  useEffect(() => {
    if (image) {
      setRemovedTags(image.manifest.removedTags);
      setExtraTags(image.manifest.extraTags);
      setInput("");
    }
  }, [image]);

  if (!image) return null;

  const chips = captionTags(dataset, { ...image.manifest, removedTags, extraTags });
  const sortedChips = [...chips].sort((a, b) =>
    sortMode === "name" ? a.localeCompare(b) : (tagCountMap.get(b) ?? 0) - (tagCountMap.get(a) ?? 0) || a.localeCompare(b),
  );
  const suggestions = input.trim() ? search(input.trim(), 6).filter((t) => !chips.includes(formatTag(t.en))) : [];
  // tagCountsはpage.tsxで件数降順ソート済み。他の画像で使われているタグのうち、この画像に未設定のものを候補として出す。
  const candidateTags = tagCounts.filter((t) => !chips.includes(t.tag));

  const save = async (nextRemoved: string[], nextExtra: string[]) => {
    const reconciled = reconcileTagLists(nextRemoved, nextExtra);
    setRemovedTags(reconciled.removedTags);
    setExtraTags(reconciled.extraTags);
    setSaving(true);
    try {
      const { image: updated } = await apiFetch<{ image: DatasetImageEntry }>("/api/lora-dataset/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, id: String(image.id), ...reconciled }),
      });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  };

  const removeTag = (tag: string) => {
    if (extraTags.includes(tag)) {
      save(removedTags, extraTags.filter((t) => t !== tag));
    } else {
      save([...removedTags, tag], extraTags);
    }
  };

  const addTag = (rawTag: string) => {
    const tag = formatTag(rawTag.trim());
    if (!tag || chips.includes(tag)) {
      setInput("");
      return;
    }
    const nextRemoved = removedTags.filter((t) => t !== tag);
    save(nextRemoved, [...extraTags, tag]);
    setInput("");
  };

  return (
    <Dialog open={!!image} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Danbooru #{image.id}
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <img
            src={`/api/lora-dataset/raw?folder=${encodeURIComponent(folder)}&id=${image.id}`}
            alt={`#${image.id}`}
            className="w-full rounded-md border object-contain"
          />

          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                トリガーワード: <span className="text-foreground">{dataset.triggerWord || "(未設定)"}</span>
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">タグをクリックすると削除されます</p>
                <div className="flex items-center gap-1">
                  {([
                    ["name", "名前順"],
                    ["count", "多い順"],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setSortMode(mode)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                        sortMode === mode
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {chips.length === 0 && <p className="text-xs text-muted-foreground">タグがありません</p>}
              {sortedChips.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => removeTag(tag)}
                >
                  {tag}
                  <span className="text-[10px] opacity-70">
                    ({tagCountMap.get(tag) ?? 0} of {totalImages})
                  </span>
                  <X className="h-2.5 w-2.5" />
                </Badge>
              ))}
            </div>

            <div className="relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input.trim()) addTag(input);
                }}
                placeholder="タグを追加..."
                className="text-xs"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-50 mt-0.5 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                  {suggestions.map((s) => (
                    <button
                      key={s.en}
                      className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTag(s.en);
                      }}
                    >
                      <span className="font-mono">{s.en}</span>
                      <span className="truncate text-[10px] text-muted-foreground">{s.ja}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {candidateTags.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">他の画像で使われているタグ（多い順）</p>
                <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                  {candidateTags.map(({ tag, count }) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer gap-1"
                      onClick={() => addTag(tag)}
                    >
                      {tag}
                      <span className="text-[10px] opacity-70">
                        ({count} of {totalImages})
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
