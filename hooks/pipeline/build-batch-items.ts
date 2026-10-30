import {
  type LoraEntry,
  type Preset,
  type QueueItem,
  type BatchPreset,
  type BatchRunOverrides,
  type BatchRunInfo,
  type VariableDefs,
  type AdetailerTarget,
  resolvePresetOverrides,
} from "@/lib/comfy";
import {
  computeAdjustedBatchCount,
  type PresetGenerationStats,
} from "@/lib/gallery-preset-stats";
import { resolveSeedPoolBatchCount } from "@/lib/gallery-seed-pool";
import {
  resolvePresetPromptAndLoras,
  buildPositivePromptWithAdditional,
} from "@/hooks/pipeline/pipeline-prompt-helpers";

export interface BatchItemsContext {
  countPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  fixedTags: string;
  fixedLoras: LoraEntry[];
  variableDefs: VariableDefs;
  adetailer: AdetailerTarget[];
  presetStats?: Record<string, PresetGenerationStats>;
}

/**
 * 一括キューのプリセット群と実行時の上書きから、プリセットごとの QueueItem を組み立てる。
 * 保存済みレシピからの再現では、ID参照ではなく overrides のプリセット(スナップショット)を使う。
 */
export function buildBatchQueueItems(
  presets: BatchPreset[],
  runOverrides: BatchRunOverrides,
  batchRun: BatchRunInfo,
  ctx: BatchItemsContext,
): QueueItem[] {
  const { countPresets, posePresets, otherPresets, fixedTags, fixedLoras, variableDefs, adetailer } =
    ctx;
  const presetStats = ctx.presetStats ?? {};

  return presets.map((preset) => {
    const overrides = resolvePresetOverrides(runOverrides, preset.id);
    const resolvedCount =
      overrides.countPreset !== undefined
        ? overrides.countPreset
        : (countPresets.find((p) => p.id === preset.countPresetId) ?? null);
    const resolvedPose =
      overrides.posePreset !== undefined
        ? overrides.posePreset
        : (posePresets.find((p) => p.id === preset.posePresetId) ?? null);
    const resolvedOthers =
      overrides.otherPresets ?? otherPresets.filter((p) => preset.otherPresetIds.includes(p.id));

    const presetFixedTags = overrides.fixedTags ?? fixedTags;
    const presetNegativePrompt = preset.negativePrompt ?? "";

    const { positivePromptBase, presetLoras } = resolvePresetPromptAndLoras({
      variableLora: overrides.variableLora,
      fixedLoras,
      fixedPrefix: presetFixedTags,
      selectedPhysicalPresets: overrides.physicalPresets,
      selectedCountPreset: resolvedCount,
      selectedPosePreset: resolvedPose,
      selectedScenePreset: overrides.scenePreset,
      selectedOtherPresets: resolvedOthers,
    });

    const { positivePrompt, additionalPromptLines } = buildPositivePromptWithAdditional(
      positivePromptBase,
      preset.additionalPrompt,
    );

    const loraLabel =
      overrides.variableLora?.name.split("/").pop()?.replace(".safetensors", "") ?? null;
    const label = [loraLabel, preset.name].filter(Boolean).join(" / ");

    // 良品率による調整(#58)とシード引き継ぎのプールサイズ切り詰め(#59)は独立した
    // 機能だが、両方指定されている場合は良品率調整後の枚数をさらにプールサイズで
    // 上限クランプする(どちらの上限も守るため)。
    const requestedCount = overrides.batchCount ?? preset.batchCount;
    const adjustedBatchCount = computeAdjustedBatchCount(requestedCount, presetStats[preset.id]);
    // シード引き継ぎ元が指定されている場合、生成枚数をプールサイズに切り詰め、
    // batch番目の生成にはこのプリセット独自ではなくプール全体から同じseedを使う
    const seedPoolBatchCount = overrides.seedPool
      ? resolveSeedPoolBatchCount(adjustedBatchCount, overrides.seedPool.length)
      : adjustedBatchCount;

    return {
      id: crypto.randomUUID(),
      label: label || "(一括)",
      filePrefix: preset.name || undefined,
      variableLora: overrides.variableLora,
      presetLoras,
      positivePrompt,
      positivePromptBase,
      negativePrompt: presetNegativePrompt,
      settings: { ...overrides.settings },
      adetailer: (overrides.adetailer ?? adetailer).map((t) => ({ ...t })),
      fixedTags: presetFixedTags,
      batchCount: seedPoolBatchCount,
      requestedBatchCount: seedPoolBatchCount !== requestedCount ? requestedCount : undefined,
      batchPresetId: preset.id,
      batchPresetSnapshot: preset,
      batchRun,
      seedPool: overrides.seedPool?.slice(0, seedPoolBatchCount),
      seedSourceFolder: overrides.seedPool ? overrides.seedSourceFolder : undefined,
      status: "pending",
      currentBatch: 0,
      completedImages: [],
      variationTags: preset.variationEnabled ? [...preset.variationTags] : [],
      additionalPromptMode: preset.additionalPromptMode,
      additionalPromptLines,
      createdAt: Date.now(),
      batchPresets: {
        selectedPhysicals: overrides.physicalPresets,
        selectedCount: resolvedCount,
        selectedPose: resolvedPose,
        selectedScene: overrides.scenePreset,
        selectedOthers: resolvedOthers,
      },
      // 変数入力値: セット単位の既定値(preset.variableValues)を、実行画面で
      // 確定した値(overrides.variableValues)で一時上書きする。
      variableInputValues: {
        ...preset.variableValues,
        ...overrides.variableValues,
      },
      variableDefs: { ...variableDefs, ...overrides.variableDefs },
      promptReplacements: overrides.promptReplacements,
      segmentEdits: overrides.segmentEdits,
      // 下絵はプリセット固有の設定(セット編集で指定)を、実行画面で ON にしたプリセットだけに適用する。既定オフ。
      imageRef: overrides.i2iEnabledPresetIds?.includes(preset.id) ? preset.imageRef : undefined,
      imageRefPool: overrides.i2iEnabledPresetIds?.includes(preset.id)
        ? preset.imageRefPool
        : undefined,
    };
  });
}
