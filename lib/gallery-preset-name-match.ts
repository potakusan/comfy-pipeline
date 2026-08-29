import { sanitizeFilePrefix, type BatchPresetSet, type ReleasedSeed } from "./comfy";

/**
 * 保存済みファイル名からComfyUIの連番サフィックス(_NNNNN_)と、再生成時に
 * 付与される_rev_NNNNサフィックスを取り除き、buildOutputPrefix()がサニタイズして
 * filename_prefixとして渡した元のプリセット名を復元する。
 *
 * lib/gallery.tsのgetPoseGroup()と似ているが、あちらは表示用グルーピングのため
 * 末尾の"_"を無条件に取り除く。プリセット名自体が"_"で終わる場合(実際に存在する)
 * それも消してしまいsanitizeFilePrefix(preset.name)と一致しなくなるため、
 * この用途専用に末尾の"_"を保持したまま返す別実装にしている。
 */
function extractFilePrefixFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  const withoutRev = stem.replace(/(?:_rev_\d+)+$/, "");
  const withoutCounter = withoutRev.replace(/_\d{5}_?$/, "");
  return withoutCounter || withoutRev || stem;
}

/**
 * batchPresetId(#58以降に生成された画像のみメタデータに記録されている)が
 * 無い/現在のセットに見つからない場合のフォールバック。保存済みファイル名は
 * 常にサニタイズ済みのプリセット名を先頭に含む(buildOutputPrefix参照)ため、
 * 復元した名前を現在のプリセット名と突き合わせて元セットを推定する。
 * プリセット名が改名されていたり、サニタイズ後に別名と衝突すると誤判定しうる
 * ベストエフォートの手段であり、batchPresetIdによる一致より弱い。
 */
export function findSetByFilenamePresetName(
  seeds: ReleasedSeed[],
  sets: BatchPresetSet[],
): BatchPresetSet | undefined {
  const nameCounts = new Map<string, number>();
  for (const seed of seeds) {
    const name = extractFilePrefixFromFilename(seed.filename);
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
