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
  migrateBatchPresetSets,
} from "@/lib/comfy";
import {
  DEFAULT_NEGATIVE,
  FIXED_POSITIVE_PREFIX,
  FIXED_LORAS,
} from "@/lib/config";
import { lsGet, lsSet } from "@/hooks/ls";

const LS = {
  fixedLoras: "cp_fixed_loras",
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
  // lsLoaded gates persist effects so they don't write defaults to localStorage
  // before the load effect has a chance to restore the user's saved values.
  const [lsLoaded, setLsLoaded] = useState(false);

  // --- LoRA ---
  const [fixedLoras, setFixedLoras] = useState<LoraEntry[]>(FIXED_LORAS);
  const [variableLoras, setVariableLoras] = useState<LoraEntry[]>([]);
  const [selectedVariableLora, setSelectedVariableLora] =
    useState<LoraEntry | null>(null);

  // --- Preset lists ---
  const [physicalPresets, setPhysicalPresets] = useState<Preset[]>(
    DEFAULT_PHYSICAL_PRESETS,
  );
  const [scenePresets, setScenePresets] = useState<Preset[]>(
    DEFAULT_SCENE_PRESETS,
  );
  const [countPresets, setCountPresets] = useState<Preset[]>(
    DEFAULT_COUNT_PRESETS,
  );
  const [posePresets, setPosePresets] =
    useState<Preset[]>(DEFAULT_POSE_PRESETS);
  const [otherPresets, setOtherPresets] = useState<Preset[]>(
    DEFAULT_OTHER_PRESETS,
  );

  // --- Selection state ---
  const [selectedPhysicalIds, setSelectedPhysicalIds] = useState<string[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedCountId, setSelectedCountId] = useState<string | null>(null);
  const [selectedPoseId, setSelectedPoseId] = useState<string | null>(null);
  const [selectedOtherIds, setSelectedOtherIds] = useState<string[]>([]);

  // --- Prompt / shared UI state ---
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [additionalPromptMode, setAdditionalPromptMode] = useState<
    "all" | "random"
  >("all");
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE);
  const [fixedTagsRaw, setFixedTagsRaw] = useState(FIXED_POSITIVE_PREFIX);
  const setFixedTags = useCallback((v: string) => {
    setFixedTagsRaw(v);
    lsSet(LS.fixedTags, v);
  }, []);
  const resetFixedTags = useCallback(() => {
    setFixedTagsRaw(FIXED_POSITIVE_PREFIX);
    lsSet(LS.fixedTags, FIXED_POSITIVE_PREFIX);
  }, []);

  // --- Variation ---
  const [variationEnabled, setVariationEnabled] = useState(false);
  const [variationTags, setVariationTags] = useState<string[]>(
    DEFAULT_COMPOSITION_TAGS,
  );

  // --- Batch preset sets ---
  const [batchPresetSets, setBatchPresetSets] = useState<BatchPresetSet[]>([]);

  // --- Preset categories ---
  const [presetCategories, setPresetCategories] = useState<PresetCategory[]>(
    [],
  );

  // --- Load from localStorage after mount (avoids SSR/client hydration mismatch) ---
  useEffect(() => {
    setFixedLoras(lsGet(LS.fixedLoras, FIXED_LORAS));
    setVariableLoras(lsGet(LS.variableLoras, []));
    setSelectedVariableLora(lsGet(LS.selectedVariableLora, null));
    setPhysicalPresets(lsGet(LS.physicalPresets, DEFAULT_PHYSICAL_PRESETS));
    setScenePresets(lsGet(LS.scenePresets, DEFAULT_SCENE_PRESETS));
    setCountPresets(lsGet(LS.countPresets, DEFAULT_COUNT_PRESETS));
    setPosePresets(lsGet(LS.posePresets, DEFAULT_POSE_PRESETS));
    setOtherPresets(lsGet(LS.otherPresets, DEFAULT_OTHER_PRESETS));
    setSelectedPhysicalIds(lsGet(LS.selectedPhysicalIds, []));
    setSelectedSceneId(lsGet(LS.selectedSceneId, null));
    setSelectedCountId(lsGet(LS.selectedCountId, null));
    setSelectedPoseId(lsGet(LS.selectedPoseId, null));
    setSelectedOtherIds(lsGet(LS.selectedOtherIds, []));
    setAdditionalPrompt(lsGet(LS.additionalPrompt, ""));
    setAdditionalPromptMode(lsGet(LS.additionalPromptMode, "all"));
    setNegativePrompt(lsGet(LS.negativePrompt, DEFAULT_NEGATIVE));
    setFixedTagsRaw(lsGet(LS.fixedTags, FIXED_POSITIVE_PREFIX));
    setVariationEnabled(lsGet(LS.variationEnabled, false));
    setVariationTags(lsGet(LS.variationTags, DEFAULT_COMPOSITION_TAGS));
    setBatchPresetSets(migrateBatchPresetSets(lsGet(LS.batchPresetSets, [])));
    setPresetCategories(lsGet(LS.presetCategories, []));
    setLsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Persist (guarded by lsLoaded to avoid overwriting LS with defaults on mount) ---
  useEffect(() => {
    if (lsLoaded) lsSet(LS.fixedLoras, fixedLoras);
  }, [lsLoaded, fixedLoras]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.variableLoras, variableLoras);
  }, [lsLoaded, variableLoras]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.selectedVariableLora, selectedVariableLora);
  }, [lsLoaded, selectedVariableLora]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.physicalPresets, physicalPresets);
  }, [lsLoaded, physicalPresets]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.scenePresets, scenePresets);
  }, [lsLoaded, scenePresets]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.countPresets, countPresets);
  }, [lsLoaded, countPresets]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.posePresets, posePresets);
  }, [lsLoaded, posePresets]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.otherPresets, otherPresets);
  }, [lsLoaded, otherPresets]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.selectedPhysicalIds, selectedPhysicalIds);
  }, [lsLoaded, selectedPhysicalIds]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.selectedSceneId, selectedSceneId);
  }, [lsLoaded, selectedSceneId]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.selectedCountId, selectedCountId);
  }, [lsLoaded, selectedCountId]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.selectedPoseId, selectedPoseId);
  }, [lsLoaded, selectedPoseId]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.selectedOtherIds, selectedOtherIds);
  }, [lsLoaded, selectedOtherIds]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.additionalPrompt, additionalPrompt);
  }, [lsLoaded, additionalPrompt]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.additionalPromptMode, additionalPromptMode);
  }, [lsLoaded, additionalPromptMode]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.negativePrompt, negativePrompt);
  }, [lsLoaded, negativePrompt]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.variationEnabled, variationEnabled);
  }, [lsLoaded, variationEnabled]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.variationTags, variationTags);
  }, [lsLoaded, variationTags]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.batchPresetSets, batchPresetSets);
  }, [lsLoaded, batchPresetSets]);
  useEffect(() => {
    if (lsLoaded) lsSet(LS.presetCategories, presetCategories);
  }, [lsLoaded, presetCategories]);

  // --- Fixed LoRA management ---
  const addFixedLora = useCallback((lora: LoraEntry) => {
    setFixedLoras((prev) => [...prev, lora]);
  }, []);

  const updateFixedLora = useCallback((index: number, lora: LoraEntry) => {
    setFixedLoras((prev) => prev.map((l, i) => (i === index ? lora : l)));
  }, []);

  const removeFixedLora = useCallback((index: number) => {
    setFixedLoras((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // --- Variable LoRA management ---
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

  const setVariableLoraArchived = useCallback(
    (index: number, archived: boolean) => {
      setVariableLoras((prev) =>
        prev.map((l, i) => (i === index ? { ...l, isArchived: archived } : l)),
      );
      if (archived) {
        setSelectedVariableLora((prev) =>
          prev?.name === variableLoras[index]?.name ? null : prev,
        );
      }
    },
    [variableLoras],
  );

  // --- Preset CRUD ---
  const addPreset = useCallback((preset: Omit<Preset, "id">) => {
    const newPreset: Preset = { ...preset, id: crypto.randomUUID() };
    if (preset.type === "physical")
      setPhysicalPresets((p) => [...p, newPreset]);
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
    setPresetCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c)),
    );
  }, []);

  const removeCategory = useCallback((id: string) => {
    setPresetCategories((prev) => prev.filter((c) => c.id !== id));
    const clearCat = (p: Preset) =>
      p.category === id ? { ...p, category: undefined } : p;
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
    // Fixed LoRA
    fixedLoras,
    setFixedLoras,
    addFixedLora,
    updateFixedLora,
    removeFixedLora,
    // Variable LoRA
    variableLoras,
    setVariableLoras,
    selectedVariableLora,
    setSelectedVariableLora,
    addVariableLora,
    updateVariableLora,
    removeVariableLora,
    setVariableLoraArchived,
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
