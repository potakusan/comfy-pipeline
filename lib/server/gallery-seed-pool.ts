import { listArchivedSeeds } from "./gallery-seed-archive";
import type { ReleasedSeed } from "@/lib/comfy";

export interface SeedPoolInfo {
  seeds: ReleasedSeed[];
  /** このグループで最も多く登場するBatchPreset.id(一括キューセットの自動特定に使う)。
   * 一括キュー以外(通常/カップルモード)由来のエントリしかない場合はundefined。 */
  batchPresetId?: string;
  /** このグループを代表する `%%name%%` 変数の解決値(最新のアーカイブエントリのもの)。
   * 引き継ぎ時、変数入力ステップの初期値として使う。 */
  bindings?: Record<string, string>;
}

/**
 * 指定フォルダ名(sourceFolder)でアーカイブされているseed一覧と、そのグループを
 * 代表するBatchPreset.id・変数バインディングを返す。出力フォルダ自体が既に
 * 削除済みでも、販売用選択時にアーカイブ済みであれば取得できる
 * (lib/server/gallery-seed-archive.ts参照)。
 */
export function getSeedPoolInfo(sourceFolder: string): SeedPoolInfo {
  // listArchivedSeeds() は archivedAt 降順。フィルタしても順序は保たれる。
  const entries = listArchivedSeeds().filter((e) => e.sourceFolder === sourceFolder);

  const seeds: ReleasedSeed[] = entries.map((e) => ({
    id: e.id,
    filename: e.sourceFilename,
    seed: e.seed,
    upscaleSeed: e.upscaleSeed,
    bindings: e.bindings,
  }));

  const presetIdCounts = new Map<string, number>();
  for (const e of entries) {
    if (!e.batchPresetId) continue;
    presetIdCounts.set(e.batchPresetId, (presetIdCounts.get(e.batchPresetId) ?? 0) + 1);
  }
  let batchPresetId: string | undefined;
  let maxCount = 0;
  for (const [id, count] of presetIdCounts) {
    if (count > maxCount) {
      maxCount = count;
      batchPresetId = id;
    }
  }

  const bindings = entries.find(
    (e) => e.bindings && Object.keys(e.bindings).length > 0,
  )?.bindings;

  return { seeds, batchPresetId, bindings };
}
