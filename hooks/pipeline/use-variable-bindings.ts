"use client";
import { useMemo } from "react";
import {
  type Preset,
  type VariablePromptSource,
  collectVariableUsages,
  extractVariableNames,
  missingRequiredInputs,
} from "@/lib/comfy";
import type { PipelineHook } from "@/hooks/pipeline/use-pipeline";

const SLOT_LABEL: Record<string, string> = {
  physical: "身体的特徴",
  count: "人数",
  pose: "ポーズ",
  scene: "シーン",
  other: "その他",
  additional: "追加プロンプト",
  fixed: "固定タグ",
};

export function slotLabel(slot: string): string {
  return SLOT_LABEL[slot] ?? slot;
}

/**
 * 通常モードで現在チェック中のプリセット・追加プロンプト・固定タグから `%%name%%`
 * 変数を集約し、使用箇所と「未入力の必須変数」を導出する。マルチキャラモードは対象外
 * (空を返す)。
 */
export function useVariableBindings(
  pipeline: PipelineHook,
  leftTabMode: "normal" | "couple",
) {
  const {
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
    fixedTags,
    variableDefs,
    variableInputValues,
  } = pipeline;

  return useMemo(() => {
    if (leftTabMode === "couple") {
      return {
        names: [] as string[],
        usages: [] as ReturnType<typeof collectVariableUsages>,
        missingRequired: [] as string[],
      };
    }

    const pick = (list: Preset[], ids: string[]) =>
      list.filter((p) => ids.includes(p.id));
    const one = (list: Preset[], id: string | null) =>
      id ? (list.find((p) => p.id === id) ?? null) : null;

    const presetSources: VariablePromptSource[] = [
      ...pick(physicalPresets, selectedPhysicalIds),
      ...(one(countPresets, selectedCountId) ? [one(countPresets, selectedCountId)!] : []),
      ...(one(posePresets, selectedPoseId) ? [one(posePresets, selectedPoseId)!] : []),
      ...(one(scenePresets, selectedSceneId) ? [one(scenePresets, selectedSceneId)!] : []),
      ...pick(otherPresets, selectedOtherIds),
    ].map((p) => ({ id: p.id, label: p.name, slot: p.type, text: p.prompt }));

    const sources: VariablePromptSource[] = [
      { id: "__fixed__", label: "固定タグ", slot: "fixed", text: fixedTags },
      ...presetSources,
      {
        id: "__additional__",
        label: "追加プロンプト",
        slot: "additional",
        text: additionalPrompt,
      },
    ];

    const usages = collectVariableUsages(sources);
    const names = extractVariableNames(sources.map((s) => s.text).join("\n"));
    const missingRequired = missingRequiredInputs({
      names,
      defs: variableDefs,
      inputValues: variableInputValues,
    });

    return { names, usages, missingRequired };
  }, [
    leftTabMode,
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
    fixedTags,
    variableDefs,
    variableInputValues,
  ]);
}
