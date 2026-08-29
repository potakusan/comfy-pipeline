"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Sprout } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { SeedArchiveGroup } from "@/app/api/gallery/seed-archive/groups/route";

function archiveThumbUrl(id: string) {
  return `/api/gallery/seed-archive/thumbnail?id=${encodeURIComponent(id)}`;
}

/**
 * 販売用選択時にアーカイブされたseedを、元フォルダ(sourceFolder)単位で一覧表示する。
 * 元フォルダ自体が既に削除されていても一覧に残り続ける(出力フォルダのライフサイクル
 * とは独立した永続保管庫、lib/server/gallery-seed-archive.ts参照)。
 * クリックすると一括キュー実行モーダル(パイプライン画面)へ ?seedSourceFolder= 付きで遷移する。
 */
export default function GallerySeedArchiveList() {
  const [groups, setGroups] = useState<SeedArchiveGroup[]>([]);

  useEffect(() => {
    apiFetch<{ groups: SeedArchiveGroup[] }>("/api/gallery/seed-archive/groups")
      .then((res) => setGroups(res.groups))
      .catch(() => {});
  }, []);

  if (groups.length === 0) return null;

  return (
    <div className="shrink-0 border-t p-2">
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
        <Sprout className="h-3 w-3" />
        シードアーカイブ
      </p>
      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {groups.map((g) => (
          <a
            key={g.folder}
            href={`/?seedSourceFolder=${encodeURIComponent(g.folder)}`}
            title="このシードを引き継いで一括キューを実行"
            className="flex items-center gap-2 rounded-lg border border-border p-1.5 text-left transition-colors hover:border-muted-foreground/50 hover:bg-muted/30"
          >
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-muted/30">
              <img
                src={archiveThumbUrl(g.thumbnailId)}
                alt={g.folder}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[10px]">{g.folder}</p>
              <Badge variant="outline" className="mt-0.5 text-[9px]">
                {g.count}枚
              </Badge>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
