import { listArchivedSeeds } from "./gallery-seed-archive";
import type { ReleasedSeed } from "@/lib/comfy";

/**
 * 指定フォルダ名(sourceFolder)でアーカイブされているseed一覧を返す。
 * 出力フォルダ自体が既に削除済みでも、販売用選択時にアーカイブ済みであれば
 * 取得できる(lib/server/gallery-seed-archive.ts参照)。
 */
export function listReleasedSeeds(sourceFolder: string): ReleasedSeed[] {
  return listArchivedSeeds()
    .filter((e) => e.sourceFolder === sourceFolder)
    .map((e) => ({ filename: e.sourceFilename, seed: e.seed, upscaleSeed: e.upscaleSeed }));
}
