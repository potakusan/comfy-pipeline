"use client";
import { useState, useCallback, useMemo } from "react";
import { resolveCouplePromptAndRegions } from "@/lib/comfy/couple";
import { assemblePositivePrompt, type Preset } from "@/lib/comfy";
import type { PipelineHook } from "@/hooks/pipeline/use-pipeline";
import type { CoupleHook } from "@/hooks/pipeline/use-couple";

function resolveRandom(p: Preset): Preset {
  if (p.promptMode !== "random") return p;
  const lines = p.prompt.split("\n").filter((s) => s.trim());
  if (!lines.length) return p;
  return { ...p, prompt: lines[Math.floor(Math.random() * lines.length)] };
}

/**
 * プレビュー用の合成ポジティブ/ネガティブプロンプトを計算する。
 * マルチキャラモードでは構図・キャラ設定からの合成、通常モードではプリセット選択からの
 * 合成と、モードごとに組み立て方が異なるため分岐している。
 */
export function usePromptPreview(
  pipeline: PipelineHook,
  couple: CoupleHook,
  leftTabMode: "normal" | "couple",
) {
  const [previewSeed, setPreviewSeed] = useState(0);
  const refreshPreview = useCallback(() => setPreviewSeed((s) => s + 1), []);

  const {
    fixedLoras,
    selectedVariableLora,
    physicalPresets,
    scenePresets,
    countPresets,
    posePresets,
    otherPresets,
    selectedPhysicalIds,
    selectedSceneId,
    selectedCountId,
    selectedPoseId,
    selectedOtherIds,
    additionalPrompt,
    additionalPromptMode,
    negativePrompt,
    fixedTags,
    variationEnabled,
    variationTags,
  } = pipeline;

  // Destructure individual stable fields from couple to avoid spurious useMemo re-runs
  // when the hook returns a new object reference on every parent render (e.g. GPU polling).
  const {
    activeConfig: coupleActiveConfig,
    selectedNormalCountId: coupleCountId,
    selectedNormalSceneId: coupleSceneId,
  } = couple;

  const { previewPositive, previewNegative, hasRandom } = useMemo(() => {
    if (leftTabMode === "couple") {
      const { positivePrompt } = resolveCouplePromptAndRegions({
        activeConfig: coupleActiveConfig,
        countPresetId: coupleCountId,
        scenePresetId: coupleSceneId,
        countPresets,
        scenePresets,
        physicalPresets,
        posePresets,
        otherPresets,
        fixedTags,
      });
      return {
        previewPositive: positivePrompt,
        previewNegative: negativePrompt,
        hasRandom: false,
      };
    }

    const selPhysicals = physicalPresets
      .filter((p) => selectedPhysicalIds.includes(p.id))
      .map(resolveRandom);
    const selScene = scenePresets.find((p) => p.id === selectedSceneId);
    const selCount = countPresets.find((p) => p.id === selectedCountId);
    const selPose = posePresets.find((p) => p.id === selectedPoseId);
    const selOthers = otherPresets
      .filter((p) => selectedOtherIds.includes(p.id))
      .map(resolveRandom);

    const addLines = additionalPrompt
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    let previewAdditional = additionalPrompt.trim();
    if (additionalPromptMode === "random" && addLines.length > 0) {
      previewAdditional = addLines[Math.floor(Math.random() * addLines.length)];
    }

    const base = assemblePositivePrompt({
      variableLora: selectedVariableLora,
      fixedLoras,
      selectedPhysicalPresets: selPhysicals,
      selectedCountPreset: selCount ? resolveRandom(selCount) : null,
      selectedPosePreset: selPose ? resolveRandom(selPose) : null,
      selectedScenePreset: selScene ? resolveRandom(selScene) : null,
      selectedOtherPresets: selOthers,
      additionalPrompt: previewAdditional,
      fixedPrefix: fixedTags,
    });

    let previewPositive = base;
    if (variationEnabled && variationTags.length > 0) {
      const tag =
        variationTags[Math.floor(Math.random() * variationTags.length)];
      previewPositive = `${base}\n\n${tag}`;
    }

    const allSelected = [
      ...physicalPresets.filter((p) => selectedPhysicalIds.includes(p.id)),
      ...(selScene ? [selScene] : []),
      ...(selCount ? [selCount] : []),
      ...(selPose ? [selPose] : []),
      ...otherPresets.filter((p) => selectedOtherIds.includes(p.id)),
    ];
    const hasRandom =
      allSelected.some((p) => p.promptMode === "random") ||
      (additionalPromptMode === "random" && addLines.length > 1) ||
      variationEnabled;

    return { previewPositive, previewNegative: negativePrompt, hasRandom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    previewSeed,
    leftTabMode,
    coupleActiveConfig,
    coupleCountId,
    coupleSceneId,
    fixedTags,
    fixedLoras,
    negativePrompt,
    physicalPresets,
    scenePresets,
    countPresets,
    posePresets,
    otherPresets,
    selectedPhysicalIds,
    selectedSceneId,
    selectedCountId,
    selectedPoseId,
    selectedOtherIds,
    selectedVariableLora,
    additionalPrompt,
    additionalPromptMode,
    variationEnabled,
    variationTags,
  ]);

  return { previewPositive, previewNegative, hasRandom, refreshPreview };
}
