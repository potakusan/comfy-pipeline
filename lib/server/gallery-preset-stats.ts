import fs from "fs";
import path from "path";
import { getOutputDir, IMAGE_EXT } from "./output-dir";
import { releaseFolderName, type ImageMetadata } from "@/lib/gallery";
import type { PresetGenerationStats } from "@/lib/gallery-preset-stats";

const THUMB_DIR = ".thumbcache";

/**
 * 全出力フォルダのサイドカーJSONを走査し、batchPresetId単位で
 * 「生成数」と「販売用(_release)に選択された数」を集計する。
 * DBが無くファイルシステムが唯一の記録なので、都度全走査する。
 */
export function computePresetStats(): Record<string, PresetGenerationStats> {
  const outputDir = getOutputDir();
  const stats: Record<string, PresetGenerationStats> = {};

  let folderNames: string[];
  try {
    folderNames = fs
      .readdirSync(outputDir, { withFileTypes: true })
      .filter(
        (e) => e.isDirectory() && e.name !== THUMB_DIR && !e.name.endsWith("_release"),
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
