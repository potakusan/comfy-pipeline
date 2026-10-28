import type { AdetailerTarget } from "./adetailer";
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
  BatchRunOverrides,
  BatchRunInfo,
  BatchPresetSet,
  PerPresetOverrides,
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
  /** 生成時の検出再描画(顔・手など)の対象。保存済みレシピからの再現で引き継ぐ */
  adetailer?: AdetailerTarget[];
  imageRef?: ImageRef;
  /** 構図プールは group と denoise のみ(ステージ済みファイル名は一時的なため保存しない) */
  imageRefPool?: Pick<ImageRefPool, "group" | "denoise">;
}

/** 保存済みフォルダ内の、1つの一括キュープリセット(+実行)に対応するレシピ。 */
export interface SeedRecipeGroup {
  /** 同一フォルダ内で一意なキー */
  key: string;
  batchPresetId?: string;
  /** 元の一括キュープリセット名(無ければ queueLabel) */
  name: string;
  queueLabel: string;
  batchRun?: BatchRunInfo;
  seeds: ReleasedSeed[];
  recipe: GenerationRecipe;
  settings?: GenerationSettings;
  bindings?: VariableBindings;
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
  /** フォルダ内のレシピをプリセット(+実行)単位に分けたもの。複数プリセットをまとめて復元するときに使う。 */
  recipes?: SeedRecipeGroup[];
}

/** perPreset の上書きを set 全体の overrides に重ねる(undefined の項目は重ねない)。 */
export function resolvePresetOverrides(
  overrides: BatchRunOverrides,
  presetId: string,
): BatchRunOverrides {
  const per = overrides.perPreset?.[presetId];
  if (!per) return overrides;
  const merged: BatchRunOverrides = { ...overrides };
  for (const [k, v] of Object.entries(per)) {
    if (v !== undefined) (merged as unknown as Record<string, unknown>)[k] = v;
  }
  return merged;
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
  adetailer?: AdetailerTarget[];
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
    adetailer: input.adetailer?.length ? input.adetailer : undefined,
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
  const uniqueSnapshots = snapshots.filter(
    (p, i) => snapshots.findIndex((q) => q.id === p.id) === i,
  );
  const snapIds = new Set(uniqueSnapshots.map((p) => p.id));
  return [...uniqueSnapshots, ...library.filter((p) => !snapIds.has(p.id))];
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

/**
 * フォルダ内の複数レシピ(プリセット+実行単位)から、1つの実行セットとプリセット別の上書きを作る。
 * 背景などのスロット構成は各レシピのまま perPreset に持たせ、set 全体の値は空にする。
 * BatchPreset.id が重複する場合(同じプリセットを別実行で使った場合)は連番を付けて区別する。
 */
export function buildRecipeSet(
  folder: string,
  groups: SeedRecipeGroup[],
): {
  set: BatchPresetSet;
  perPreset: Record<string, PerPresetOverrides>;
  /** set.presets と同じ順の元グループ */
  groups: SeedRecipeGroup[];
} {
  const used = new Map<string, number>();
  const perPreset: Record<string, PerPresetOverrides> = {};
  const presets = groups.map((g) => {
    const p = batchPresetFromRecipe(g.recipe, {
      id: `recipe:${folder}:${g.key}`,
      name: g.name,
      batchCount: Math.max(1, g.seeds.length),
    });
    const n = (used.get(p.id) ?? 0) + 1;
    used.set(p.id, n);
    const id = n === 1 ? p.id : `${p.id}#${n}`;
    const r = g.recipe;
    perPreset[id] = {
      variableLora: r.variableLora,
      physicalPresets: r.presets.selectedPhysicals,
      scenePreset: r.presets.selectedScene,
      countPreset: r.presets.selectedCount,
      posePreset: r.presets.selectedPose,
      otherPresets: r.presets.selectedOthers,
      fixedTags: r.fixedTags,
      batchCount: Math.max(1, g.seeds.length),
      ...(r.adetailer ? { adetailer: r.adetailer } : {}),
    };
    return { ...p, id };
  });
  return {
    set: { id: `recipe:${folder}`, name: `保存済みレシピ(${folder})`, presets },
    perPreset,
    groups,
  };
}

/** ギャラリーの「あとn枚」がパイプライン画面へ渡す、レシピ1件分の追加生成リクエスト */
export interface MoreGenerationRequest {
  count: number;
  group: SeedRecipeGroup;
}

/**
 * 保存済みレシピと同じプリセット構成で、ランダム部分(seed・ランダム抽選プリセット・追加プロンプトのランダム行・
 * ランダム変数)を引き直して count 枚追加生成するための実行内容を作る。入力モードの変数は前回値を引き継ぐ。
 */
export function buildMoreGenerationRun(
  group: SeedRecipeGroup,
  count: number,
): { presets: BatchPreset[]; overrides: BatchRunOverrides } | null {
  if (!group.settings) return null;
  const { set, perPreset } = buildRecipeSet(group.key, [group]);
  const id = set.presets[0].id;
  perPreset[id].batchCount = Math.max(1, Math.floor(count) || 1);
  return {
    presets: set.presets,
    overrides: {
      variableLora: null,
      physicalPresets: [],
      scenePreset: null,
      fixedTags: "",
      settings: { ...group.settings, randomizeSeed: true },
      perPreset,
      variableValues: group.bindings,
      variableDefs: group.recipe.variableDefs,
      batchSet: { id: set.id, name: group.name },
      i2iEnabledPresetIds: [],
    },
  };
}
