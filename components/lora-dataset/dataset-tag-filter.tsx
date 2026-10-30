"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TagFilterState = "include" | "exclude";

interface Props {
  tagCounts: { tag: string; count: number }[];
  filters: Record<string, TagFilterState>;
  onToggle: (tag: string) => void;
  onHover: (tag: string | null) => void;
  onClear: () => void;
  /** 指定時、各タグに「全画像から削除」の×ボタンを出す */
  onRemove?: (tag: string, count: number) => void;
  /** 指定時、選択中(include)のタグが1つ以上あると「選択中のタグを全画像から削除」ボタンを出す */
  onRemoveSelected?: (tags: string[]) => void;
}

/** クリックで neutral -> include -> exclude -> neutral と3状態を巡回するタグ一覧。 */
export default function DatasetTagFilter({
  tagCounts,
  filters,
  onToggle,
  onHover,
  onClear,
  onRemove,
  onRemoveSelected,
}: Props) {
  const hasFilters = Object.keys(filters).length > 0;
  const existing = new Set(tagCounts.map((t) => t.tag));
  const selectedTags = Object.entries(filters)
    .filter(([tag, state]) => state === "include" && existing.has(tag))
    .map(([tag]) => tag);
  if (tagCounts.length === 0 && !hasFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b px-3 pb-3" onMouseLeave={() => onHover(null)}>
      {tagCounts.map(({ tag, count }) => {
        const state = filters[tag];
        return (
          <Badge
            key={tag}
            variant={state === "include" ? "default" : state === "exclude" ? "destructive" : "outline"}
            className={cn(
              "cursor-pointer select-none",
              state === "exclude" && "line-through opacity-70",
            )}
            onMouseEnter={() => onHover(tag)}
            onClick={() => onToggle(tag)}
          >
            {tag} ({count})
            {onRemove && (
              <button
                type="button"
                className="-mr-1 ml-1 rounded-full p-0.5 hover:bg-foreground/20"
                title={`「${tag}」を全画像から削除`}
                aria-label={`「${tag}」を全画像から削除`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(tag, count);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        );
      })}
      {onRemoveSelected && selectedTags.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 gap-1 px-1.5 text-[10px] text-destructive hover:text-destructive"
          onClick={() => onRemoveSelected(selectedTags)}
        >
          <Trash2 className="h-2.5 w-2.5" />
          選択中の{selectedTags.length}個を全画像から削除
        </Button>
      )}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground"
          onClick={onClear}
        >
          <X className="h-2.5 w-2.5" />
          フィルタ解除
        </Button>
      )}
    </div>
  );
}
