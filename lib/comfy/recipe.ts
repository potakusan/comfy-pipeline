import type {
  BatchPreset,
  ImageRef,
  ImageRefPool,
  LoraEntry,
  Preset,
  PresetType,
  QueueItemBatchPresets,
  GenerationSettings,
  ReleasedSeed,
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

/** ギャラリー/保存済みプリセットから引き継ぐ、フォルダ単位のシード引き継ぎ元。 */
export interface SeedSource {
  folder: string;
  seeds: ReleasedSeed[];
  batchPresetId?: string;
  bindings?: VariableBindings;
  /** あれば保存済みレシピからの再現モードになる */
  recipe?: GenerationRecipe;
  /** レシピと同じエントリの生成設定(実行前設定の初期値) */
  settings?: GenerationSettings;
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

/**
 * 保存済みレシピから実行用の BatchPreset を復元する(下絵は含めない)。元の BatchPreset スナップショットがあれば
 * それを土台にし(ID・名前・枚数を維持して良品率集計と出力名を揃える)、スロットの選択・追加プロンプト・
 * 固定タグ等は常にレシピ側の値で上書きする。
 */
export function batchPresetFromRecipe(
  recipe: GenerationRecipe,
  fallback: { id: string; name: string; batchCount: number },
): BatchPreset {
  const base = recipe.batchPreset;
  return {
    id: base?.id ?? fallback.id,
    name: base?.name ?? fallback.name,
    countPresetId: recipe.presets.selectedCount?.id ?? null,
    posePresetId: recipe.presets.selectedPose?.id ?? null,
    otherPresetIds: recipe.presets.selectedOthers.map((p) => p.id),
    additionalPrompt: recipe.additionalPrompt.lines.join("\n"),
    additionalPromptMode: recipe.additionalPrompt.mode,
    fixedTags: recipe.fixedTags,
    negativePrompt: recipe.negativePrompt,
    variationEnabled: recipe.variationTags.length > 0,
    variationTags: [...recipe.variationTags],
    batchCount: base?.batchCount ?? fallback.batchCount,
    variableValues: { ...recipe.variableInputValues },
    // 再現はプロンプトのみ(t2i)。下絵(imageRef / 構図プール)は復元しない
  };
}

/**
 * 選択肢の一覧を「保存時のスナップショット優先 + ライブラリの残り」で作る。
 * 保存後にライブラリ側でプリセットが編集・削除されていても、保存時の内容を選べる。
 */
export function mergePresetsWithSnapshot(
  library: Preset[],
  snapshots: Preset[],
): Preset[] {
  const snapIds = new Set(snapshots.map((p) => p.id));
  return [...snapshots, ...library.filter((p) => !snapIds.has(p.id))];
}

/** 削除で生じた空行の連続(3つ以上の改行)を詰め、前後の空白行を除く。 */
function tidyAfterDeletion(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
}

/**
 * 断片編集(置換前→置換後、置換後が空なら削除)を変数解決前のプロンプトへ順に適用する。
 * from が空の編集は無視する。
 */
export function applySegmentEdits(
  text: string,
  edits: PromptReplacement[] | undefined,
): string {
  if (!text || !edits?.length) return text;
  let out = text;
  let deleted = false;
  for (const { from, to } of edits) {
    if (!from) continue;
    if (!to) deleted = true;
    out = out.split(from).join(to);
  }
  return deleted ? tidyAfterDeletion(out) : out;
}

/** 断片リストへ編集を反映する(編集後に空になった断片は除く)。レシピを再保存するときに使う。 */
export function applySegmentEditsToSegments(
  segments: RecipeSegment[],
  edits: PromptReplacement[] | undefined,
): RecipeSegment[] {
  if (!edits?.length) return segments;
  return segments.flatMap((s) => {
    const text = applySegmentEdits(s.text, edits);
    return text.trim() ? [{ ...s, text }] : [];
  });
}
