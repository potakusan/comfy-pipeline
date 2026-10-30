import {
  type LoraEntry,
  type Preset,
  type QueueItem,
  type QueueItemBatchPresets,
  type RandomChoice,
  type GenerationRecipe,
  type VariableBindings,
  isCommentLine,
  buildPromptSegments,
  buildGenerationRecipe,
  applySegmentEdits,
  applySegmentEditsToSegments,
} from "@/lib/comfy";
import { slotLabel } from "@/hooks/pipeline/use-variable-bindings";
import {
  resolvePresetPromptAndLoras,
  resolvePromptVariables,
} from "@/hooks/pipeline/pipeline-prompt-helpers";

export interface ResolvedBatch {
  batchPrompt: string;
  pickedAdditional: string | undefined;
  batchAllLoras: LoraEntry[];
  resolvedBindings: VariableBindings;
  batchInitImage: { name: string; denoise: number } | undefined;
  batchChoices: RandomChoice[];
  batchRecipe: GenerationRecipe | undefined;
}

function resolveRandomPreset(p: Preset, choices: RandomChoice[]): Preset {
  if (p.promptMode !== "random") return p;
  const lines = p.prompt.split("\n").filter((s) => s.trim() && !isCommentLine(s));
  if (!lines.length) return p;
  const picked = lines[Math.floor(Math.random() * lines.length)];
  choices.push({
    source: `${slotLabel(p.type)}: ${p.name}`,
    picked,
    options: lines,
  });
  return { ...p, prompt: picked };
}

/**
 * キューアイテム1枚分のランダム部分(ランダム抽選プリセット・追加プロンプト・バリエーション・
 * 変数・下絵)を引き直し、プロンプト・LoRA・レシピを確定させる。呼ぶたびに再抽選される。
 *
 * @param fixedLoras 常時適用する固定LoRA
 * @param poolNames 構図プールのステージ済みファイル名(無ければ空)
 */
export function resolveItemBatch(
  item: QueueItem,
  fixedLoras: LoraEntry[],
  poolNames: string[],
): ResolvedBatch {
  const bp = item.batchPresets;
  const anyPresetRandom = [
    ...bp.selectedPhysicals,
    ...(bp.selectedCount ? [bp.selectedCount] : []),
    ...(bp.selectedPose ? [bp.selectedPose] : []),
    ...(bp.selectedScene ? [bp.selectedScene] : []),
    ...bp.selectedOthers,
  ].some((p) => p.promptMode === "random");

  const batchChoices: RandomChoice[] = [];
  let presetBase: string;
  let batchPresetLoras: LoraEntry[];
  let resolvedPresets: QueueItemBatchPresets = bp;

  if (anyPresetRandom) {
    const batchPhysicals = bp.selectedPhysicals.map((p) => resolveRandomPreset(p, batchChoices));
    const batchCountPreset = bp.selectedCount
      ? resolveRandomPreset(bp.selectedCount, batchChoices)
      : null;
    const batchPose = bp.selectedPose ? resolveRandomPreset(bp.selectedPose, batchChoices) : null;
    const batchScene = bp.selectedScene ? resolveRandomPreset(bp.selectedScene, batchChoices) : null;
    const batchOthers = bp.selectedOthers.map((p) => resolveRandomPreset(p, batchChoices));

    const resolved = resolvePresetPromptAndLoras({
      variableLora: item.variableLora,
      fixedLoras,
      fixedPrefix: item.fixedTags,
      selectedPhysicalPresets: batchPhysicals,
      selectedCountPreset: batchCountPreset,
      selectedPosePreset: batchPose,
      selectedScenePreset: batchScene,
      selectedOtherPresets: batchOthers,
    });
    resolvedPresets = {
      selectedPhysicals: batchPhysicals,
      selectedCount: batchCountPreset,
      selectedPose: batchPose,
      selectedScene: batchScene,
      selectedOthers: batchOthers,
    };
    presetBase = resolved.positivePromptBase;
    batchPresetLoras = resolved.presetLoras;
  } else {
    presetBase = item.positivePromptBase;
    batchPresetLoras = item.presetLoras;
  }

  const batchAllLoras = [
    ...fixedLoras,
    ...batchPresetLoras,
    ...(item.variableLora && !item.variableLora.isPromptOnly ? [item.variableLora] : []),
  ];

  let pickedAdditional: string | undefined;
  let promptWithAdditional: string;
  if (item.additionalPromptMode === "random" && item.additionalPromptLines.length > 0) {
    pickedAdditional =
      item.additionalPromptLines[Math.floor(Math.random() * item.additionalPromptLines.length)];
    if (item.additionalPromptLines.length > 1) {
      batchChoices.push({
        source: "追加プロンプト",
        picked: pickedAdditional ?? "",
        options: item.additionalPromptLines,
      });
    }
    promptWithAdditional = pickedAdditional
      ? `${presetBase}\n\n${pickedAdditional}`
      : presetBase;
  } else if (item.additionalPromptLines.length > 0) {
    pickedAdditional = item.additionalPromptLines.join("\n");
    promptWithAdditional = `${presetBase}\n\n${pickedAdditional}`;
  } else {
    promptWithAdditional = presetBase;
  }

  let batchPrompt = promptWithAdditional;
  let pickedVariation: string | undefined;
  if (item.variationTags.length > 0) {
    const tag = item.variationTags[Math.floor(Math.random() * item.variationTags.length)];
    if (item.variationTags.length > 1) {
      batchChoices.push({
        source: "ランダム構図",
        picked: tag,
        options: item.variationTags,
      });
    }
    pickedVariation = tag;
    batchPrompt = `${promptWithAdditional}\n\n${tag}`;
  }

  // 保存済みレシピの断片編集は、変数解決前のプロンプトとレシピ断片の両方へ反映する
  batchPrompt = applySegmentEdits(batchPrompt, item.segmentEdits);

  // 通常モードのみ、選択項目ごとの構造化レシピを変数解決前の断片で残す
  let batchRecipe: GenerationRecipe | undefined;
  if (!item.colorMaskWorkflow && !item.coupleWorkflow) {
    batchRecipe = buildGenerationRecipe({
      variableLora: item.variableLora,
      fixedLoras,
      fixedTags: item.fixedTags,
      negativePrompt: item.negativePrompt,
      presets: bp,
      additionalPromptMode: item.additionalPromptMode,
      additionalPromptLines: item.additionalPromptLines,
      variationTags: item.variationTags,
      batchPreset: item.batchPresetSnapshot,
      segments: applySegmentEditsToSegments(
        buildPromptSegments({
          fixedTags: item.fixedTags,
          fixedLoras,
          variableLora: item.variableLora,
          presets: resolvedPresets,
          additionalText: pickedAdditional,
          variationTag: pickedVariation,
        }),
        item.segmentEdits,
      ),
      variableDefs: item.variableDefs,
      variableInputValues: item.variableInputValues,
      promptReplacements: item.promptReplacements,
      imageRef: item.imageRef,
      imageRefPool: item.imageRefPool,
      adetailer: item.adetailer,
    });
  }

  // %%name%% 変数の解決は、プリセット/追加/バリエーションの抽選をすべて
  // 済ませた最終文字列に対して1回だけ行う。確定した bindings はメタデータへ
  // 保存し、シード引き継ぎ時のランダム要素再現に使う。
  // 定義・入力値ともキュー登録時点でアイテムに焼き込まれたスナップショットのみを使う
  // (実行中に変数ウィンドウを編集しても、既に積まれたアイテムの結果が変わらないようにするため)。
  const itemVariableDefs = item.variableDefs ?? {};
  const varResolved = resolvePromptVariables({
    prompt: batchPrompt,
    variableDefs: itemVariableDefs,
    variableInputValues: item.variableInputValues ?? {},
    promptReplacements: item.promptReplacements,
  });
  batchPrompt = varResolved.prompt;
  const resolvedBindings = varResolved.bindings;

  for (const [name, val] of Object.entries(resolvedBindings)) {
    const def = itemVariableDefs[name];
    if (def?.mode === "random") {
      batchChoices.push({
        source: `%%${name}%%`,
        picked: val,
        options: def.candidates ?? [],
      });
    }
  }

  // 下絵: 構図プールがあれば毎バッチ1枚ランダム、なければ単一 imageRef、どちらも無ければ txt2img。
  let batchInitImage: { name: string; denoise: number } | undefined;
  if (poolNames.length > 0) {
    batchInitImage = {
      name: poolNames[Math.floor(Math.random() * poolNames.length)],
      denoise: item.imageRefPool!.denoise,
    };
  } else if (item.imageRef) {
    batchInitImage = { name: item.imageRef.name, denoise: item.imageRef.denoise };
  }

  return {
    batchPrompt,
    pickedAdditional,
    batchAllLoras,
    resolvedBindings,
    batchInitImage,
    batchChoices,
    batchRecipe,
  };
}
