import { getPoseGroup } from "./gallery";
import { sanitizeFilePrefix, type BatchPresetSet, type ReleasedSeed } from "./comfy";

/**
 * batchPresetId(#58以降に生成された画像のみメタデータに記録されている)が
 * 無い/現在のセットに見つからない場合のフォールバック。保存済みファイル名は
 * 常にサニタイズ済みのプリセット名を先頭に含む(buildOutputPrefix参照)ため、
 * getPoseGroup()で復元した名前を現在のプリセット名と突き合わせて元セットを推定する。
 * プリセット名が改名されていたり、サニタイズ後に別名と衝突すると誤判定しうる
 * ベストエフォートの手段であり、batchPresetIdによる一致より弱い。
 */
export function findSetByFilenamePresetName(
  seeds: ReleasedSeed[],
  sets: BatchPresetSet[],
): BatchPresetSet | undefined {
  const nameCounts = new Map<string, number>();
  for (const seed of seeds) {
    const name = getPoseGroup(seed.filename);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  let bestName: string | undefined;
  let bestCount = 0;
  for (const [name, count] of nameCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestName = name;
    }
  }
  if (!bestName) return undefined;

  return sets.find((set) =>
    set.presets.some((p) => sanitizeFilePrefix(p.name) === bestName),
  );
}
