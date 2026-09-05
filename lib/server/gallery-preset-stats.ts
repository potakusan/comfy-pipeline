import fs from "fs";
import path from "path";
import { getOutputDir, IMAGE_EXT } from "./output-dir";
import { releaseFolderName, type ImageMetadata } from "@/lib/gallery";
import { SEED_ARCHIVE_DIR } from "./gallery-seed-archive";
import { I2I_DIR } from "./i2i-pool";
import type { PresetGenerationStats } from "@/lib/gallery-preset-stats";

const THUMB_DIR = ".thumbcache";

/** 全走査は重い(画像1枚ごとにサイドカーJSONを読む)ため結果をキャッシュする。
 * 新規生成(metadata POST)・販売用選択の増減(release)・削除で無効化される。
 * それらを取りこぼしても最大この時間で自然に反映されるようにするTTLの保険付き。 */
const CACHE_TTL_MS = 60_000;
let cache: { value: Record<string, PresetGenerationStats>; at: number } | null = null;

/** サイドカーJSON・_release の増減で集計結果が変わったときに呼ぶ。次回取得で再走査される。 */
export function invalidatePresetStatsCache(): void {
  cache = null;
}

/**
 * 全出力フォルダのサイドカーJSONを走査し、batchPresetId単位で
 * 「生成数」と「販売用(_release)に選択された数」を集計する。
 * DBが無くファイルシステムが唯一の記録なので、都度全走査する(結果はキャッシュ)。
 */
export function computePresetStats(): Record<string, PresetGenerationStats> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  const value = scanPresetStats();
  cache = { value, at: Date.now() };
  return value;
}

function scanPresetStats(): Record<string, PresetGenerationStats> {
  const outputDir = getOutputDir();
  const stats: Record<string, PresetGenerationStats> = {};

  let folderNames: string[];
  try {
    folderNames = fs
      .readdirSync(outputDir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() &&
          e.name !== THUMB_DIR &&
          e.name !== SEED_ARCHIVE_DIR &&
          e.name !== I2I_DIR &&
          !e.name.endsWith("_release"),
      )
      .map((e) => e.name);
  } catch {
    return stats;
  }

  for (const folder of folderNames) {
    const folderPath = path.join(outputDir, folder);
    const releasePath = path.join(outputDir, releaseFolderName(folder));

    let files: string[];
    try {
      files = fs.readdirSync(folderPath).filter((f) => IMAGE_EXT.test(f));
    } catch {
      continue;
    }

    for (const filename of files) {
      let meta: ImageMetadata | null = null;
      try {
        const raw = fs.readFileSync(path.join(folderPath, `${filename}.json`), "utf-8");
        meta = JSON.parse(raw) as ImageMetadata;
      } catch {
        continue;
      }

      const presetId = meta?.batchPresetId;
      if (!presetId) continue;

      const entry = stats[presetId] ?? (stats[presetId] = { generated: 0, released: 0 });
      entry.generated++;
      if (fs.existsSync(path.join(releasePath, filename))) entry.released++;
    }
  }

  return stats;
}
