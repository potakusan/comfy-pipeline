"use client";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckSquare, Loader2, Square } from "lucide-react";
import { useTagDatabase } from "@/hooks/use-tag-database";
import { formatTag } from "@/lib/lora-dataset/caption-format";

interface Props {
  tagCounts: { tag: string; count: number }[];
  totalImages: number;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedCount: number;
  applying: boolean;
  onApply: (tag: string) => void;
}

export default function BulkTagAddBar({
  tagCounts,
  totalImages,
  selectionMode,
  onToggleSelectionMode,
  selectedCount,
  applying,
  onApply,
}: Props) {
  const { search } = useTagDatabase();
  const [input, setInput] = useState("");

  const countMap = useMemo(() => new Map(tagCounts.map((t) => [t.tag, t.count])), [tagCounts]);
  const previewTag = formatTag(input.trim());
  const previewCount = previewTag ? (countMap.get(previewTag) ?? 0) : null;
  const suggestions = input.trim() ? search(input.trim(), 6) : [];

  const canApply = !!previewTag && selectedCount > 0 && !applying;

  const apply = () => {
    if (!canApply) return;
    onApply(input);
    setInput("");
  };

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <div className="relative w-64">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
          placeholder="タグを一括追加..."
          className="text-xs"
        />
        {previewTag && (
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {previewCount} of {totalImages}
          </span>
        )}
        {suggestions.length > 0 && (
          <div className="absolute z-50 mt-0.5 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
            {suggestions.map((s) => {
              const tag = formatTag(s.en);
              const count = countMap.get(tag) ?? 0;
              return (
                <button
                  key={s.en}
                  className="flex w-full items-baseline justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setInput(s.en);
                  }}
                >
                  <span>
                    <span className="font-mono">{s.en}</span>
                    <span className="ml-2 truncate text-[10px] text-muted-foreground">{s.ja}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {count} of {totalImages}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Button
        variant={selectionMode ? "default" : "outline"}
        size="sm"
        className="gap-1.5 text-xs"
        onClick={onToggleSelectionMode}
      >
        {selectionMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        選択モード{selectionMode && `（${selectedCount}件選択中）`}
      </Button>

      <Button size="sm" className="gap-1.5 text-xs" onClick={apply} disabled={!canApply}>
        {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        適用
      </Button>
    </div>
  );
}
