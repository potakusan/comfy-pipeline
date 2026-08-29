import fs from "fs";
import path from "path";
import { getOutputDir, safePath, IMAGE_EXT } from "./output-dir";
import { releaseFolderName, type ImageMetadata } from "@/lib/gallery";
import type { ReleasedSeed } from "@/lib/comfy";

/**
 * 指定フォルダ内で販売用(_release)に選択済みの画像から、
 * seed/upscaleSeedを一覧化する。一括キューの「シード引き継ぎ」機能の
 * 引き継ぎ元候補として使う。
 */
export function listReleasedSeeds(folder: string): ReleasedSeed[] {
  const outputDir = getOutputDir();
  const folderPath = safePath(outputDir, folder);
  if (!folderPath) return [];

  const releasePath = safePath(outputDir, releaseFolderName(folder));

  let files: string[];
  try {
    files = fs.readdirSync(folderPath).filter((f) => IMAGE_EXT.test(f));
  } catch {
    return [];
  }

  const seeds: ReleasedSeed[] = [];
  for (const filename of files) {
    if (!releasePath || !fs.existsSync(path.join(releasePath, filename))) continue;

    let meta: ImageMetadata | null = null;
    try {
      const raw = fs.readFileSync(path.join(folderPath, `${filename}.json`), "utf-8");
      meta = JSON.parse(raw) as ImageMetadata;
    } catch {
      continue;
    }

    if (!meta?.settings) continue;
    seeds.push({
      filename,
      seed: meta.settings.seed,
      upscaleSeed: meta.settings.upscaleSeed ?? null,
    });
  }

  return seeds;
}
