import {
  type LoraEntry,
  type Preset,
  collectPresetLoras,
  assemblePositivePrompt,
  isCommentLine,
  stripCommentLines,
} from "@/lib/comfy";

/**
 * 選択中の5スロット(physical/count/pose/scene/other)のプリセットから、
 * ベースとなるポジティブプロンプトと適用対象LoRA一覧を組み立てる。
 * addToQueue・runBatchPresets・キュー処理本体(ランダムプリセットの再抽選時)の
 * 3箇所でほぼ同一の組み立て処理が行われていたため共通化した。
 */
export function resolvePresetPromptAndLoras(input: {
  variableLora: LoraEntry | null;
  fixedLoras: LoraEntry[];
  fixedPrefix: string;
  selectedPhysicalPresets: Preset[];
  selectedCountPreset: Preset | null;
  selectedPosePreset: Preset | null;
  selectedScenePreset: Preset | null;
  selectedOtherPresets: Preset[];
}): { positivePromptBase: string; presetLoras: LoraEntry[] } {
  const positivePromptBase = assemblePositivePrompt({
    variableLora: input.variableLora,
    fixedLoras: input.fixedLoras,
    selectedPhysicalPresets: input.selectedPhysicalPresets,
    selectedCountPreset: input.selectedCountPreset,
    selectedPosePreset: input.selectedPosePreset,
    selectedScenePreset: input.selectedScenePreset,
    selectedOtherPresets: input.selectedOtherPresets,
    additionalPrompt: "",
    fixedPrefix: input.fixedPrefix,
  });

  const presetLoras = collectPresetLoras([
    ...input.selectedPhysicalPresets,
    ...(input.selectedCountPreset ? [input.selectedCountPreset] : []),
    ...(input.selectedPosePreset ? [input.selectedPosePreset] : []),
    ...(input.selectedScenePreset ? [input.selectedScenePreset] : []),
    ...input.selectedOtherPresets,
  ]);

  return { positivePromptBase, presetLoras };
}

/**
 * 追加プロンプト欄のテキストをコメント行除去した行リストへ分割し、あれば
 * ベースプロンプトの後ろに2行空けて連結する。addToQueue・runBatchPresetsで
 * 同一実装だったため共通化した。
 */
export function buildPositivePromptWithAdditional(
  positivePromptBase: string,
  additionalPromptText: string,
): { positivePrompt: string; additionalPromptLines: string[] } {
  const additionalPromptLines = additionalPromptText
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !isCommentLine(s));

  const positivePrompt =
    additionalPromptLines.length > 0
      ? `${positivePromptBase}\n\n${stripCommentLines(additionalPromptText).trim()}`
      : positivePromptBase;

  return { positivePrompt, additionalPromptLines };
}
