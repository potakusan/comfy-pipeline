import type {
  BatchPreset,
  ImageRef,
  ImageRefPool,
  LoraEntry,
  Preset,
  PresetType,
  QueueItemBatchPresets,
} from "./comfy-types";
import { stripCommentLines } from "./prompt-assembly";
import {
  extractVariableNames,
  getVariableDef,
  type PromptReplacement,
  type VariableBindings,
  type VariableDef,
  type VariableDefs,
} from "./prompt-variables";

/** プロンプト断片の出どころ。再利用時に「どこ由来の文か」を問わず差し替えるための識別子。 */
export type RecipeSegmentSource =
  | "fixedTags"
  | "fixedLora"
  | "variableLora"
  | "preset"
  | "presetLora"
  | "additional"
  | "variation";

export interface RecipeSegment {
  source: RecipeSegmentSource;
  /** source が preset / presetLora のときのスロット種別 */
  slot?: PresetType;
  presetId?: string;
  presetName?: string;
  /** `%%name%%` を解決する前のテキスト */
  text: string;
}

/** サイドカーに保存する構造化データ。後からプリセット定義が変わっても再現できるよう全文スナップショットで持つ。 */
export interface GenerationRecipe {
  schemaVersion: 1;
  variableLora: LoraEntry | null;
  fixedLoras: LoraEntry[];
  fixedTags: string;
  negativePrompt: string;
  /** 抽選前のスロット別プリセット(promptMode:"random" は元の全行を保持。当たり行は segments / randomChoices 側) */
  presets: QueueItemBatchPresets;
  additionalPrompt: { mode: "all" | "random"; lines: string[] };
  variationTags: string[];
  batchPreset?: BatchPreset;
  segments: RecipeSegment[];
  /** segments が参照している変数の定義スナップショット(グローバル定義が後で変わっても再現できる) */
  variableDefs: Record<string, VariableDef>;
  variableInputValues: VariableBindings;
  promptReplacements: PromptReplacement[];
  imageRef?: ImageRef;
  /** 構図プールは group と denoise のみ(ステージ済みファイル名は一時的なため保存しない) */
  imageRefPool?: Pick<ImageRefPool, "group" | "denoise">;
}

function pushPresetSegments(
  out: RecipeSegment[],
  preset: Preset,
) {
  const prompt = stripCommentLines(preset.prompt);
  const ref = { slot: preset.type, presetId: preset.id, presetName: preset.name };
  if (prompt.trim()) out.push({ source: "preset", ...ref, text: prompt });
  const trigger = preset.lora?.triggerWords?.trim();
  if (trigger) out.push({ source: "presetLora", ...ref, text: trigger });
}

/**
 * assemblePositivePrompt と同じ順序・同じ除去規則で、プロンプトを出どころ付きの断片に分解する。
 * 断片を "\n\n" で連結すると(空断片を除き)組み立て済みプロンプトと一致する。
 */
export function buildPromptSegments(input: {
  fixedTags: string;
  fixedLoras: LoraEntry[];
  variableLora: LoraEntry | null;
  /** 抽選済みの(promptMode:"random" は当たり行のみの)プリセット */
  presets: QueueItemBatchPresets;
  additionalText?: string;
  variationTag?: string;
}): RecipeSegment[] {
  const out: RecipeSegment[] = [];

  const fixedTags = stripCommentLines(input.fixedTags);
  if (fixedTags.trim()) out.push({ source: "fixedTags", text: fixedTags });

  for (const lora of input.fixedLoras) {
    const t = lora.triggerWords?.trim();
    if (t) out.push({ source: "fixedLora", text: t });
  }
  const variableTrigger = input.variableLora?.triggerWords?.trim();
  if (variableTrigger) out.push({ source: "variableLora", text: variableTrigger });

  const p = input.presets;
  for (const preset of p.selectedPhysicals) pushPresetSegments(out, preset);
  if (p.selectedCount) pushPresetSegments(out, p.selectedCount);
  if (p.selectedPose) pushPresetSegments(out, p.selectedPose);
  if (p.selectedScene) pushPresetSegments(out, p.selectedScene);
  for (const preset of p.selectedOthers) pushPresetSegments(out, preset);

  if (input.additionalText?.trim())
    out.push({ source: "additional", text: input.additionalText.trim() });
  if (input.variationTag?.trim())
    out.push({ source: "variation", text: input.variationTag });

  return out;
}

/** セグメント中に出現する変数だけの定義スナップショットを作る。 */
export function snapshotUsedVariableDefs(
  segments: RecipeSegment[],
  defs: VariableDefs,
): Record<string, VariableDef> {
  const names = extractVariableNames(segments.map((s) => s.text).join("\n"));
  const out: Record<string, VariableDef> = {};
  for (const name of names) out[name] = getVariableDef(defs, name);
  return out;
}

export function buildGenerationRecipe(input: {
  variableLora: LoraEntry | null;
  fixedLoras: LoraEntry[];
  fixedTags: string;
  negativePrompt: string;
  presets: QueueItemBatchPresets;
  additionalPromptMode: "all" | "random";
  additionalPromptLines: string[];
  variationTags: string[];
  batchPreset?: BatchPreset;
  segments: RecipeSegment[];
  variableDefs?: VariableDefs;
  variableInputValues?: VariableBindings;
  promptReplacements?: PromptReplacement[];
  imageRef?: ImageRef;
  imageRefPool?: ImageRefPool;
}): GenerationRecipe {
  return {
    schemaVersion: 1,
    variableLora: input.variableLora,
    fixedLoras: input.fixedLoras,
    fixedTags: input.fixedTags,
    negativePrompt: input.negativePrompt,
    presets: input.presets,
    additionalPrompt: {
      mode: input.additionalPromptMode,
      lines: input.additionalPromptLines,
    },
    variationTags: input.variationTags,
    batchPreset: input.batchPreset,
    segments: input.segments,
    variableDefs: snapshotUsedVariableDefs(input.segments, input.variableDefs ?? {}),
    variableInputValues: input.variableInputValues ?? {},
    promptReplacements: input.promptReplacements ?? [],
    imageRef: input.imageRef,
    imageRefPool: input.imageRefPool
      ? { group: input.imageRefPool.group, denoise: input.imageRefPool.denoise }
      : undefined,
  };
}
