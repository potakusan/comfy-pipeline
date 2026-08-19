"use client";
import { useCallback } from "react";
import {
  type LoraEntry,
  type GenerationSettings,
  type Preset,
  type BatchPresetSet,
  type PresetCategory,
  migrateBatchPresetSets,
} from "@/lib/comfy";
import { lsGet, lsSet } from "@/hooks/ls";
import { LS_GROUP_BY_POSE } from "@/lib/gallery";
import type { PromptPreviewPos } from "@/hooks/pipeline/use-pipeline-settings";

export interface PipelineIOState {
  variableLoras: LoraEntry[];
  setVariableLoras: (v: LoraEntry[]) => void;
  physicalPresets: Preset[];
  setPhysicalPresets: (v: Preset[]) => void;
  scenePresets: Preset[];
  setScenePresets: (v: Preset[]) => void;
  countPresets: Preset[];
  setCountPresets: (v: Preset[]) => void;
  posePresets: Preset[];
  setPosePresets: (v: Preset[]) => void;
  otherPresets: Preset[];
  setOtherPresets: (v: Preset[]) => void;
  settings: GenerationSettings;
  setSettings: (v: GenerationSettings) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  fixedTags: string;
  setFixedTags: (v: string) => void;
  variationTags: string[];
  setVariationTags: (v: string[]) => void;
  batchPresetSets: BatchPresetSet[];
  setBatchPresetSets: (v: BatchPresetSet[]) => void;
  presetCategories: PresetCategory[];
  setPresetCategories: (v: PresetCategory[]) => void;
  panelSizes: Record<string, number>;
  setPanelSizes: (v: Record<string, number>) => void;
  promptPreviewPos: PromptPreviewPos;
  setPromptPreviewPos: (v: PromptPreviewPos) => void;
  etaPos: PromptPreviewPos;
  setEtaPos: (v: PromptPreviewPos) => void;
}

/** 設定・プリセット・LoRA一式をJSONファイルとして書き出す/読み込む。 */
export function usePipelineIO(state: PipelineIOState) {
  const {
    variableLoras,
    setVariableLoras,
    physicalPresets,
    setPhysicalPresets,
    scenePresets,
    setScenePresets,
    countPresets,
    setCountPresets,
    posePresets,
    setPosePresets,
    otherPresets,
    setOtherPresets,
    settings,
    setSettings,
    negativePrompt,
    setNegativePrompt,
    fixedTags,
    setFixedTags,
    variationTags,
    setVariationTags,
    batchPresetSets,
    setBatchPresetSets,
    presetCategories,
    setPresetCategories,
    panelSizes,
    setPanelSizes,
    promptPreviewPos,
    setPromptPreviewPos,
    etaPos,
    setEtaPos,
  } = state;

  const exportData = useCallback(() => {
    const data = {
      version: 1,
      variableLoras,
      physicalPresets,
      scenePresets,
      countPresets,
      posePresets,
      otherPresets,
      settings,
      negativePrompt,
      fixedTags,
      variationTags,
      batchPresetSets,
      presetCategories,
      panelSizes,
      promptPreviewPos,
      etaPos,
      // Gallery page settings (owned by hooks/use-gallery.ts, read directly
      // from localStorage here since it's a separate page/hook).
      galleryGroupByPose: lsGet(LS_GROUP_BY_POSE, false),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comfy-pipeline-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    variableLoras,
    physicalPresets,
    scenePresets,
    countPresets,
    posePresets,
    otherPresets,
    settings,
    negativePrompt,
    fixedTags,
    variationTags,
    batchPresetSets,
    presetCategories,
    panelSizes,
    promptPreviewPos,
    etaPos,
  ]);

  const importData = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.version !== 1) throw new Error("Unsupported version");
          if (Array.isArray(data.variableLoras)) setVariableLoras(data.variableLoras);
          if (Array.isArray(data.physicalPresets)) setPhysicalPresets(data.physicalPresets);
          if (Array.isArray(data.scenePresets)) setScenePresets(data.scenePresets);
          if (Array.isArray(data.countPresets)) setCountPresets(data.countPresets);
          if (Array.isArray(data.posePresets)) setPosePresets(data.posePresets);
          if (Array.isArray(data.otherPresets)) setOtherPresets(data.otherPresets);
          if (data.settings && typeof data.settings === "object") setSettings(data.settings);
          if (typeof data.negativePrompt === "string") setNegativePrompt(data.negativePrompt);
          if (typeof data.fixedTags === "string") setFixedTags(data.fixedTags);
          if (Array.isArray(data.variationTags)) setVariationTags(data.variationTags);
          if (Array.isArray(data.batchPresetSets)) setBatchPresetSets(migrateBatchPresetSets(data.batchPresetSets));
          if (Array.isArray(data.presetCategories)) setPresetCategories(data.presetCategories);
          if (data.panelSizes && typeof data.panelSizes === "object") setPanelSizes(data.panelSizes);
          if (data.promptPreviewPos && typeof data.promptPreviewPos === "object") setPromptPreviewPos(data.promptPreviewPos as PromptPreviewPos);
          if (data.etaPos && typeof data.etaPos === "object") setEtaPos(data.etaPos as PromptPreviewPos);
          if (typeof data.galleryGroupByPose === "boolean") lsSet(LS_GROUP_BY_POSE, data.galleryGroupByPose);
        } catch (err) {
          console.error("[pipeline] Import failed:", err);
        }
      };
      reader.readAsText(file);
    },
    [
      setVariableLoras,
      setPhysicalPresets,
      setScenePresets,
      setCountPresets,
      setPosePresets,
      setOtherPresets,
      setSettings,
      setNegativePrompt,
      setFixedTags,
      setVariationTags,
      setBatchPresetSets,
      setPresetCategories,
      setPanelSizes,
      setPromptPreviewPos,
      setEtaPos,
    ],
  );

  return { exportData, importData };
}
