import type { GalleryImage, GenerationSettings, QueueItem } from "@/lib/comfy";
import type { GenerationMode } from "@/lib/gallery";
import type { ResolvedBatch } from "@/hooks/pipeline/resolve-batch";

/**
 * 生成された画像を GalleryImage にまとめ、ローカル保存(リモート時)とメタデータJSONの保存を投げる。
 * メタデータのサイドカーはプロンプト・シード等を残す唯一の永続記録のため、全画像に対して書き出す。
 *
 * @param subfolder ComfyUI出力フォルダ内のサブフォルダ(= ギャラリーのフォルダ名)
 * @param settings 実際に使ったseedを反映済みの生成設定
 */
export function saveBatchImages(
  item: QueueItem,
  resolved: ResolvedBatch,
  subfolder: string,
  newFiles: string[],
  settings: GenerationSettings,
): { images: GalleryImage[]; persisted: Promise<unknown> } {
  const remoteSave: Promise<unknown> =
    newFiles.length > 0
      ? fetch("/api/comfy/output/save-remote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: newFiles.map((f) => `${subfolder}/${f}`) }),
        }).catch(() => {})
      : Promise.resolve();

  const { batchPrompt, pickedAdditional, batchAllLoras, resolvedBindings, batchChoices, batchRecipe } =
    resolved;
  const bindingsForMeta = Object.keys(resolvedBindings).length > 0 ? resolvedBindings : undefined;
  const choicesForMeta = batchChoices.length > 0 ? batchChoices : undefined;

  const newImages: GalleryImage[] = newFiles.map((filename) => ({
    id: crypto.randomUUID(),
    path: `${subfolder}/${filename}`,
    loraName: item.variableLora?.name || "no-lora",
    positivePrompt: batchPrompt,
    negativePrompt: item.negativePrompt,
    settings,
    loras: batchAllLoras,
    queueLabel: item.label,
    createdAt: Date.now(),
    appliedAdditional: pickedAdditional,
    batchPresetId: item.batchPresetId,
    batchRun: item.batchRun,
    bindings: bindingsForMeta,
    randomChoices: choicesForMeta,
  }));

  const mode: GenerationMode = item.colorMaskWorkflow
    ? "colorMask"
    : item.coupleWorkflow
      ? "couple"
      : "normal";
  const writes = newImages.map((img) =>
    fetch("/api/gallery/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: img.path,
        metadata: {
          mode,
          loraName: img.loraName,
          positivePrompt: img.positivePrompt,
          negativePrompt: img.negativePrompt,
          settings: img.settings,
          loras: img.loras,
          queueLabel: img.queueLabel,
          createdAt: img.createdAt,
          appliedAdditional: img.appliedAdditional,
          batchPresetId: img.batchPresetId,
          batchRun: img.batchRun,
          bindings: img.bindings,
          randomChoices: img.randomChoices,
          recipe: batchRecipe,
          ...(mode === "colorMask"
            ? {
                colorMaskControlNet: item.colorMaskControlNet,
                colorMaskRegions: item.colorMaskRegions,
              }
            : {}),
        },
      }),
    }).catch(() => {}),
  );

  return { images: newImages, persisted: Promise.all([remoteSave, ...writes]) };
}
