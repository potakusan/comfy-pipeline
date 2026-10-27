import type { SeedRecipeGroup } from "@/lib/comfy";
import type { SeedArchiveEntry } from "./gallery-seed-archive";

function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** 同じプリセット・同じ実行・同じスロット構成(背景など)のエントリを同一グループとして扱うキー。 */
export function recipeGroupKey(e: SeedArchiveEntry): string | null {
  const recipe = e.metadata?.recipe;
  if (!recipe) return null;
  const id = e.batchPresetId ?? e.metadata?.queueLabel ?? "";
  const run = e.metadata?.batchRun?.runId ?? "";
  return `${id}|${run}|${shortHash(JSON.stringify(recipe.presets ?? null))}`;
}

/**
 * レシピ付きエントリを一括キューのプリセット(+実行)単位に分ける。
 * entries は archivedAt 降順を想定し、各グループの代表レシピは最新のエントリのものを使う。
 */
export function groupEntriesByRecipe(entries: SeedArchiveEntry[]): SeedRecipeGroup[] {
  const groups = new Map<string, SeedRecipeGroup>();
  for (const e of entries) {
    const key = recipeGroupKey(e);
    const recipe = e.metadata?.recipe;
    if (!key || !recipe) continue;
    const seed = {
      id: e.id,
      filename: e.sourceFilename,
      seed: e.seed,
      upscaleSeed: e.upscaleSeed,
      bindings: e.bindings,
    };
    const existing = groups.get(key);
    if (existing) {
      existing.seeds.push(seed);
      continue;
    }
    const queueLabel = e.metadata?.queueLabel ?? "";
    groups.set(key, {
      key,
      batchPresetId: e.batchPresetId,
      name: recipe.batchPreset?.name || queueLabel.split(" / ").pop() || queueLabel || e.sourceFilename,
      queueLabel,
      batchRun: e.metadata?.batchRun,
      seeds: [seed],
      recipe,
      settings: e.metadata?.settings,
      bindings: e.bindings,
    });
  }
  return Array.from(groups.values());
}
