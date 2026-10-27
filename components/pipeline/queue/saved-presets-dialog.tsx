"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { SeedArchiveGroup } from "@/app/api/gallery/seed-archive/groups/route";

interface SavedPresetsDialogProps {
  /** 選んだ保存済みプリセット(元フォルダ名)から一括キューの実行前設定へ進む */
  onSelect: (folder: string) => void;
}

/**
 * 販売用選択時に保存された保存済みプリセット(`_savedpresets`)を元フォルダ単位で一覧し、
 * 選んだものを元に一括キューを作成する入口。ギャラリー左ペインの一覧と同じデータを使う。
 */
export default function SavedPresetsDialog({ onSelect }: SavedPresetsDialogProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<SeedArchiveGroup[] | null>(null);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) return;
    setGroups(null);
    apiFetch<{ groups: SeedArchiveGroup[] }>("/api/gallery/seed-archive/groups")
      .then((res) => setGroups(res.groups))
      .catch(() => setGroups([]));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <BookmarkCheck className="h-3.5 w-3.5" />
          保存済みプリセット
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="text-sm">保存済みプリセットから作成</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {groups === null ? (
            <p className="py-6 text-center text-xs text-muted-foreground">読み込み中…</p>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              保存済みプリセットがありません。ギャラリーで画像を「販売用に選択」すると保存されます。
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {groups.map((g) => (
                <button
                  key={g.folder}
                  onClick={() => {
                    setOpen(false);
                    onSelect(g.folder);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-border p-1.5 text-left transition-colors hover:border-muted-foreground/50 hover:bg-muted/30"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/gallery/seed-archive/thumbnail?id=${encodeURIComponent(g.thumbnailId)}`}
                      alt={g.folder}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px]">{g.folder}</p>
                    <Badge variant="outline" className="mt-0.5 text-[9px]">
                      {g.count}枚
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
