import { NextResponse } from "next/server";
import { listArchivedSeeds } from "@/lib/server/gallery-seed-archive";

export interface SeedArchiveGroup {
  folder: string;
  count: number;
  /** プレビュー用サムネのID(そのグループで最新のエントリ) */
  thumbnailId: string;
}

/** GET /api/gallery/seed-archive/groups
 *  アーカイブ済みseedを元フォルダ名(sourceFolder)単位でグルーピングして返す。
 *  元フォルダが既に削除済みでも一覧に残り続ける。
 */
export async function GET() {
  const entries = listArchivedSeeds();
  const groups = new Map<string, SeedArchiveGroup>();

  for (const e of entries) {
    const existing = groups.get(e.sourceFolder);
    if (existing) {
      existing.count++;
    } else {
      groups.set(e.sourceFolder, { folder: e.sourceFolder, count: 1, thumbnailId: e.id });
    }
  }

  return NextResponse.json({ groups: Array.from(groups.values()) });
}
