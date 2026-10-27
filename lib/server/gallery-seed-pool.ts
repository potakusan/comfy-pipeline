import { listArchivedSeeds } from "./gallery-seed-archive";
import type { GenerationRecipe, GenerationSettings, ReleasedSeed, SeedRecipeGroup } from "@/lib/comfy";
import { groupEntriesByRecipe } from "./gallery-recipe-groups";

export interface SeedPoolInfo {
  seeds: ReleasedSeed[];
  /** このグループで最も多く登場するBatchPreset.id(一括キューセットの自動特定に使う)。
   * 一括キュー以外(通常/カップルモード)由来のエントリしかない場合はundefined。 */
  batchPresetId?: string;
  /** このグループを代表する `%%name%%` 変数の解決値(最新のアーカイブエントリのもの)。
   * 引き継ぎ時、変数入力ステップの初期値として使う。 */
  bindings?: Record<string, string>;
  /** このグループで最新のレシピ付きエントリのレシピ(保存済みレシピからの部分差し替え再生成の土台)。 */
  recipe?: GenerationRecipe;
  /** 同エントリの生成設定(チェックポイント・サイズ等。seed は各 seeds 側を使う)。 */
  settings?: GenerationSettings;
  /** フォルダ内のレシピを一括キューのプリセット(+実行)単位に分けたもの。 */
  recipes: SeedRecipeGroup[];
}

/**
 * 指定フォルダ名(sourceFolder)でアーカイブされているseed一覧と、そのグループを
 * 代表するBatchPreset.id・変数バインディングを返す。出力フォルダ自体が既に
 * 削除済みでも、販売用選択時にアーカイブ済みであれば取得できる
 * (lib/server/gallery-seed-archive.ts参照)。
 */
export async function getSeedPoolInfo(sourceFolder: string): Promise<SeedPoolInfo> {
  // listArchivedSeeds() は archivedAt 降順。フィルタしても順序は保たれる。
  const entries = (await listArchivedSeeds()).filter((e) => e.sourceFolder === sourceFolder);

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

  const withRecipe = entries.find((e) => e.metadata?.recipe);

  return {
    seeds,
    batchPresetId,
    bindings,
    recipe: withRecipe?.metadata?.recipe,
    settings: withRecipe?.metadata?.settings,
    recipes: groupEntriesByRecipe(entries),
  };
}
