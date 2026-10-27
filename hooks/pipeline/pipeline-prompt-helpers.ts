import {
  type LoraEntry,
  type Preset,
  type BatchPresetSet,
  type BatchRunOverrides,
  type VariableBindings,
  type VariableDefs,
  type PromptReplacement,
  type VariablePromptSource,
  collectPresetLoras,
  assemblePositivePrompt,
  isCommentLine,
  stripCommentLines,
  extractVariableNames,
  resolveBindings,
  applyVariableBindings,
  applyPromptReplacements,
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

/**
 * 組み立て済みプロンプト中の `%%name%%` を解決し、確定したバインディングを返す。
 * 1バッチ1回、キュー処理本体から呼ぶ。変数が無ければ入力プロンプトをそのまま返す。
 * 解決後、変数化していない箇所向けの文字列置換(promptReplacements)も適用する。
 */
export function resolvePromptVariables(input: {
  prompt: string;
  variableDefs: VariableDefs;
  variableInputValues: VariableBindings;
  promptReplacements?: PromptReplacement[];
}): { prompt: string; bindings: VariableBindings } {
  const names = extractVariableNames(input.prompt);
  let bindings: VariableBindings = {};
  let prompt = input.prompt;
  if (names.length > 0) {
    bindings = resolveBindings({
      names,
      defs: input.variableDefs,
      inputValues: input.variableInputValues,
    });
    prompt = applyVariableBindings(prompt, bindings);
  }
  prompt = applyPromptReplacements(prompt, input.promptReplacements);
  return { prompt, bindings };
}

/**
 * セット＋実行前オーバーライドが参照する `%%name%%` の走査対象一覧を作る。
 * 単発実行の変数検知(setUsesVariables)・変数入力ステップ(VariableInputView)・
 * 一括実行の変数入力ステップ(BulkVariableInputView)の3箇所で同じ組み立てが
 * 必要だったため共通化した。
 */
export function collectSetVariableSources(input: {
  set: BatchPresetSet;
  overrides: Pick<BatchRunOverrides, "physicalPresets" | "scenePreset">;
  fixedTags: string;
  countPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  /** 複数セットを束ねて扱うとき、使用箇所ラベルの先頭に付けるセット名 */
  setLabel?: string;
}): VariablePromptSource[] {
  const { set, overrides, fixedTags, countPresets, posePresets, otherPresets, setLabel } =
    input;
  const prefix = setLabel ? `${setLabel} › ` : "";
  const sources: VariablePromptSource[] = [];
  if (fixedTags)
    sources.push({
      id: `${set.id}:__fixed__`,
      label: `${prefix}固定タグ`,
      slot: "fixed",
      text: fixedTags,
    });
  for (const bp of set.presets) {
    const ctx = bp.name || "(無名プリセット)";
    const push = (p: Preset | null | undefined) => {
      if (p)
        sources.push({
          id: `${set.id}:${bp.id}:${p.id}`,
          label: `${prefix}${ctx} › ${p.name}`,
          slot: p.type,
          text: p.prompt,
        });
    };
    push(countPresets.find((p) => p.id === bp.countPresetId));
    push(posePresets.find((p) => p.id === bp.posePresetId));
    for (const oid of bp.otherPresetIds)
      push(otherPresets.find((p) => p.id === oid));
    if (bp.additionalPrompt)
      sources.push({
        id: `${set.id}:${bp.id}:additional`,
        label: `${prefix}${ctx} › 追加プロンプト`,
        slot: "additional",
        text: bp.additionalPrompt,
      });
    if (bp.fixedTags)
      sources.push({
        id: `${set.id}:${bp.id}:fixed`,
        label: `${prefix}${ctx} › 固定タグ`,
        slot: "fixed",
        text: bp.fixedTags,
      });
  }
  for (const p of overrides.physicalPresets)
    sources.push({
      id: `${set.id}:ov:${p.id}`,
      label: `${prefix}身体的特徴 › ${p.name}`,
      slot: p.type,
      text: p.prompt,
    });
  if (overrides.scenePreset)
    sources.push({
      id: `${set.id}:ov:${overrides.scenePreset.id}`,
      label: `${prefix}シーン › ${overrides.scenePreset.name}`,
      slot: overrides.scenePreset.type,
      text: overrides.scenePreset.prompt,
    });
  return sources;
}
