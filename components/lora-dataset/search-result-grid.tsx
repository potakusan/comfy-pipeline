"use client";
import { Check, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DanbooruPost } from "@/lib/lora-dataset/types";

const RATING_LABEL: Record<string, string> = { g: "G", s: "S", q: "Q", e: "E" };

interface Props {
  posts: DanbooruPost[];
  addedIds: Set<number>;
  addingId: number | null;
  onAdd: (post: DanbooruPost) => void;
}

export default function SearchResultGrid({ posts, addedIds, addingId, onAdd }: Props) {
  if (posts.length === 0) {
    return <p className="p-4 text-center text-xs text-muted-foreground">検索結果がありません</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-2 overflow-y-auto p-3 sm:grid-cols-6 lg:grid-cols-8">
      {posts.map((post) => {
        const added = addedIds.has(post.id);
        const disabled = !post.available || added || addingId === post.id;
        return (
          <button
            key={post.id}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-md border bg-muted",
              !post.available && "opacity-40",
            )}
            disabled={disabled}
            onClick={() => onAdd(post)}
            title={post.available ? `#${post.id} を追加` : "この投稿は画像として取得できません"}
          >
            {post.previewUrl ? (
              <img src={post.previewUrl} alt={`danbooru #${post.id}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                プレビューなし
              </div>
            )}
            <Badge variant="secondary" className="absolute top-1 left-1 text-[9px]">
              {RATING_LABEL[post.rating] ?? post.rating}
            </Badge>
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity",
                !disabled && "group-hover:opacity-100",
                added && "opacity-100 bg-black/50",
              )}
            >
              {addingId === post.id ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : added ? (
                <Check className="h-5 w-5 text-white" />
              ) : post.available ? (
                <Plus className="h-5 w-5 text-white" />
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
