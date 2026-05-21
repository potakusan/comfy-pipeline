"use client";
import { useState, useCallback, useEffect } from "react";
import {
  type LoraEntry,
  type Preset,
  type PresetCategory,
  type BatchPresetSet,
  DEFAULT_PHYSICAL_PRESETS,
  DEFAULT_SCENE_PRESETS,
  DEFAULT_COUNT_PRESETS,
  DEFAULT_POSE_PRESETS,
  DEFAULT_OTHER_PRESETS,
  DEFAULT_COMPOSITION_TAGS,
} from "@/lib/comfy";
import { DEFAULT_NEGATIVE, FIXED_POSITIVE_PREFIX } from "@/lib/config";
import { lsGet, lsSet } from "@/hooks/ls";

const LS = {
  variableLoras: "cp_variable_loras",
  selectedVariableLora: "cp_selected_variable_lora",
  physicalPresets: "cp_physical_presets",
  scenePresets: "cp_scene_presets",
  countPresets: "cp_count_presets",
  posePresets: "cp_pose_presets",
  otherPresets: "cp_other_presets",
  selectedPhysicalIds: "cp_selected_physical_ids",
  selectedSceneId: "cp_selected_scene_id",
  selectedCountId: "cp_selected_count_id",
  selectedPoseId: "cp_selected_pose_id",
  selectedOtherIds: "cp_selected_other_ids",
  additionalPrompt: "cp_additional_prompt",
  additionalPromptMode: "cp_additional_prompt_mode",
  negativePrompt: "cp_negative_prompt",
  fixedTags: "cp_fixed_tags",
  variationEnabled: "cp_variation_enabled",
  variationTags: "cp_variation_tags",
  batchPresetSets: "cp_batch_preset_sets",
  presetCategories: "cp_preset_categories",
};

// ---------------------------------------------------------------------------
// 単体キャラ専用ロジック
// プリセット、可変LoRA、プロンプト状態、バリエーション、バッチプリセットセット
// ---------------------------------------------------------------------------

export function useNormalMode() {
  // --- LoRA ---
  const [variableLoras, setVariableLoras] = useState<LoraEntry[]>(() =>
    lsGet(LS.variableLoras, []),
  );
  const [selectedVariableLora, setSelectedVariableLora] =
    useState<LoraEntry | null>(() => lsGet(LS.selectedVariableLora, null));

  // --- Preset lists ---
  const [physicalPresets, setPhysicalPresets] = useState<Preset[]>(() =>
    lsGet(LS.physicalPresets, DEFAULT_PHYSICAL_PRESETS),
  );
  const [scenePresets, setScenePresets] = useState<Preset[]>(() =>
    lsGet(LS.scenePresets, DEFAULT_SCENE_PRESETS),
  );
  const [countPresets, setCountPresets] = useState<Preset[]>(() =>
    lsGet(LS.countPresets, DEFAULT_COUNT_PRESETS),
  );
  const [posePresets, setPosePresets] = useState<Preset[]>(() =>
    lsGet(LS.posePresets, DEFAULT_POSE_PRESETS),
  );
  const [otherPresets, setOtherPresets] = useState<Preset[]>(() =>
    lsGet(LS.otherPresets, DEFAULT_OTHER_PRESETS),
  );

  // --- Selection state ---
  const [selectedPhysicalIds, setSelectedPhysicalIds] = useState<string[]>(() =>
    lsGet(LS.selectedPhysicalIds, []),
  );
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(() =>
    lsGet(LS.selectedSceneId, null),
  );
  const [selectedCountId, setSelectedCountId] = useState<string | null>(() =>
    lsGet(LS.selectedCountId, null),
  );
  const [selectedPoseId, setSelectedPoseId] = useState<string | null>(() =>
    lsGet(LS.selectedPoseId, null),
  );
  const [selectedOtherIds, setSelectedOtherIds] = useState<string[]>(() =>
    lsGet(LS.selectedOtherIds, []),
  );

  // --- Prompt / shared UI state ---
  const [additionalPrompt, setAdditionalPrompt] = useState(() =>
    lsGet(LS.additionalPrompt, ""),
  );
  const [additionalPromptMode, setAdditionalPromptMode] = useState<
    "all" | "random"
  >(() => lsGet(LS.additionalPromptMode, "all"));
  const [negativePrompt, setNegativePrompt] = useState(() =>
    lsGet(LS.negativePrompt, DEFAULT_NEGATIVE),
  );
  const [fixedTagsRaw, setFixedTagsRaw] = useState(() =>
    lsGet(LS.fixedTags, FIXED_POSITIVE_PREFIX),
  );
  const setFixedTags = useCallback((v: string) => {
    setFixedTagsRaw(v);
    lsSet(LS.fixedTags, v);
  }, []);
  const resetFixedTags = useCallback(() => {
    setFixedTagsRaw(FIXED_POSITIVE_PREFIX);
    lsSet(LS.fixedTags, FIXED_POSITIVE_PREFIX);
  }, []);

  // --- Variation ---
  const [variationEnabled, setVariationEnabled] = useState(() =>
    lsGet(LS.variationEnabled, false),
  );
  const [variationTags, setVariationTags] = useState<string[]>(() =>
    lsGet(LS.variationTags, DEFAULT_COMPOSITION_TAGS),
  );

  // --- Batch preset sets ---
  const [batchPresetSets, setBatchPresetSets] = useState<BatchPresetSet[]>(() =>
    lsGet(LS.batchPresetSets, []),
  );

  // --- Preset categories ---
  const [presetCategories, setPresetCategories] = useState<PresetCategory[]>(() =>
    lsGet(LS.presetCategories, []),
  );

  // --- Persist ---
  useEffect(() => { lsSet(LS.variableLoras, variableLoras); }, [variableLoras]);
  useEffect(() => { lsSet(LS.selectedVariableLora, selectedVariableLora); }, [selectedVariableLora]);
  useEffect(() => { lsSet(LS.physicalPresets, physicalPresets); }, [physicalPresets]);
  useEffect(() => { lsSet(LS.scenePresets, scenePresets); }, [scenePresets]);
  useEffect(() => { lsSet(LS.countPresets, countPresets); }, [countPresets]);
  useEffect(() => { lsSet(LS.posePresets, posePresets); }, [posePresets]);
  useEffect(() => { lsSet(LS.otherPresets, otherPresets); }, [otherPresets]);
  useEffect(() => { lsSet(LS.selectedPhysicalIds, selectedPhysicalIds); }, [selectedPhysicalIds]);
  useEffect(() => { lsSet(LS.selectedSceneId, selectedSceneId); }, [selectedSceneId]);
  useEffect(() => { lsSet(LS.selectedCountId, selectedCountId); }, [selectedCountId]);
  useEffect(() => { lsSet(LS.selectedPoseId, selectedPoseId); }, [selectedPoseId]);
  useEffect(() => { lsSet(LS.selectedOtherIds, selectedOtherIds); }, [selectedOtherIds]);
  useEffect(() => { lsSet(LS.additionalPrompt, additionalPrompt); }, [additionalPrompt]);
  useEffect(() => { lsSet(LS.additionalPromptMode, additionalPromptMode); }, [additionalPromptMode]);
  useEffect(() => { lsSet(LS.negativePrompt, negativePrompt); }, [negativePrompt]);
  useEffect(() => { lsSet(LS.variationEnabled, variationEnabled); }, [variationEnabled]);
  useEffect(() => { lsSet(LS.variationTags, variationTags); }, [variationTags]);
  useEffect(() => { lsSet(LS.batchPresetSets, batchPresetSets); }, [batchPresetSets]);
  useEffect(() => { lsSet(LS.presetCategories, presetCategories); }, [presetCategories]);

  // --- LoRA management ---
  const addVariableLora = useCallback((lora: LoraEntry) => {
    setVariableLoras((prev) => [...prev, lora]);
  }, []);

  const updateVariableLora = useCallback(
    (index: number, lora: LoraEntry) => {
      setVariableLoras((prev) => prev.map((l, i) => (i === index ? lora : l)));
      setSelectedVariableLora((prev) =>
        prev && variableLoras[index] && prev.name === variableLoras[index].name
          ? lora
          : prev,
      );
    },
    [variableLoras],
  );

  const removeVariableLora = useCallback(
    (index: number) => {
      const removed = variableLoras[index];
      setVariableLoras((prev) => prev.filter((_, i) => i !== index));
      setSelectedVariableLora((prev) =>
        prev?.name === removed?.name ? null : prev,
      );
    },
    [variableLoras],
  );

  // --- Preset CRUD ---
  const addPreset = useCallback((preset: Omit<Preset, "id">) => {
    const newPreset: Preset = { ...preset, id: crypto.randomUUID() };
    if (preset.type === "physical") setPhysicalPresets((p) => [...p, newPreset]);
    else if (preset.type === "scene") setScenePresets((p) => [...p, newPreset]);
    else if (preset.type === "count") setCountPresets((p) => [...p, newPreset]);
    else if (preset.type === "pose") setPosePresets((p) => [...p, newPreset]);
    else setOtherPresets((p) => [...p, newPreset]);
  }, []);

  const updatePreset = useCallback((id: string, updates: Partial<Preset>) => {
    const upd = (p: Preset) => (p.id === id ? { ...p, ...updates } : p);
    setPhysicalPresets((p) => p.map(upd));
    setScenePresets((p) => p.map(upd));
    setCountPresets((p) => p.map(upd));
    setPosePresets((p) => p.map(upd));
    setOtherPresets((p) => p.map(upd));
  }, []);

  const removePreset = useCallback((id: string) => {
    setPhysicalPresets((p) => p.filter((x) => x.id !== id));
    setScenePresets((p) => p.filter((x) => x.id !== id));
    setCountPresets((p) => p.filter((x) => x.id !== id));
    setPosePresets((p) => p.filter((x) => x.id !== id));
    setOtherPresets((p) => p.filter((x) => x.id !== id));
    setSelectedPhysicalIds((p) => p.filter((pid) => pid !== id));
    setSelectedSceneId((p) => (p === id ? null : p));
    setSelectedCountId((p) => (p === id ? null : p));
    setSelectedPoseId((p) => (p === id ? null : p));
    setSelectedOtherIds((p) => p.filter((pid) => pid !== id));
  }, []);

  const reorderPresets = useCallback(
    (type: Preset["type"], fromIndex: number, toIndex: number) => {
      const move = (arr: Preset[]) => {
        const next = [...arr];
        const [item] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        return next;
      };
      if (type === "physical") setPhysicalPresets(move);
      else if (type === "scene") setScenePresets(move);
      else if (type === "count") setCountPresets(move);
      else if (type === "pose") setPosePresets(move);
      else setOtherPresets(move);
    },
    [],
  );

  // --- Selection toggles ---
  const togglePhysicalPreset = useCallback((id: string) => {
    setSelectedPhysicalIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  }, []);

  const selectCountPreset = useCallback((id: string | null) => {
    setSelectedCountId((prev) => (prev === id ? null : id));
  }, []);

  const selectPosePreset = useCallback((id: string | null) => {
    setSelectedPoseId((prev) => (prev === id ? null : id));
  }, []);

  const toggleOtherPreset = useCallback((id: string) => {
    setSelectedOtherIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  }, []);

  // --- Category management ---
  const addCategory = useCallback((name: string) => {
    setPresetCategories((prev) => [...prev, { id: crypto.randomUUID(), name }]);
  }, []);

  const renameCategory = useCallback((id: string, name: string) => {
    setPresetCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  const removeCategory = useCallback((id: string) => {
    setPresetCategories((prev) => prev.filter((c) => c.id !== id));
    const clearCat = (p: Preset) => p.category === id ? { ...p, category: undefined } : p;
    setPhysicalPresets((p) => p.map(clearCat));
    setScenePresets((p) => p.map(clearCat));
    setCountPresets((p) => p.map(clearCat));
    setPosePresets((p) => p.map(clearCat));
    setOtherPresets((p) => p.map(clearCat));
  }, []);

  // --- Batch preset set management ---
  const saveBatchPresetSet = useCallback((set: BatchPresetSet) => {
    setBatchPresetSets((prev) => {
      const idx = prev.findIndex((s) => s.id === set.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = set;
        return next;
      }
      return [...prev, set];
    });
  }, []);

  const removeBatchPresetSet = useCallback((id: string) => {
    setBatchPresetSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    // LoRA
    variableLoras,
    setVariableLoras,
    selectedVariableLora,
    setSelectedVariableLora,
    addVariableLora,
    updateVariableLora,
    removeVariableLora,
    // Preset lists
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
    // Selection
    selectedPhysicalIds,
    togglePhysicalPreset,
    selectedSceneId,
    setSelectedSceneId,
    selectedCountId,
    selectCountPreset,
    selectedPoseId,
    selectPosePreset,
    selectedOtherIds,
    toggleOtherPreset,
    reorderPresets,
    // Preset CRUD
    addPreset,
    updatePreset,
    removePreset,
    // Prompt state
    additionalPrompt,
    setAdditionalPrompt,
    additionalPromptMode,
    setAdditionalPromptMode,
    negativePrompt,
    setNegativePrompt,
    fixedTags: fixedTagsRaw,
    setFixedTags,
    resetFixedTags,
    // Variation
    variationEnabled,
    setVariationEnabled,
    variationTags,
    setVariationTags,
    // Batch preset sets
    batchPresetSets,
    setBatchPresetSets,
    saveBatchPresetSet,
    removeBatchPresetSet,
    // Categories
    presetCategories,
    setPresetCategories,
    addCategory,
    renameCategory,
    removeCategory,
  };
}

export type NormalModeHook = ReturnType<typeof useNormalMode>;
