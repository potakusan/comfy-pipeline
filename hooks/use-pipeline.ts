"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  type LoraEntry,
  type GenerationSettings,
  type Preset,
  type QueueItem,
  type GalleryImage,
  type BatchPreset,
  type BatchPresetSet,
  DEFAULT_PHYSICAL_PRESETS,
  DEFAULT_SCENE_PRESETS,
  DEFAULT_COUNT_PRESETS,
  DEFAULT_POSE_PRESETS,
  DEFAULT_OTHER_PRESETS,
  DEFAULT_COMPOSITION_TAGS,
  collectPresetLoras,
  assemblePositivePrompt,
  buildWorkflow,
  buildOutputPrefix,
} from "@/lib/comfy";
import { useComfyWS } from "./use-comfy-ws";
import { DEFAULT_NEGATIVE, DEFAULT_SETTINGS, FIXED_LORAS } from "@/lib/config";

const LS = {
  variableLoras: "cp_variable_loras",
  physicalPresets: "cp_physical_presets",
  scenePresets: "cp_scene_presets",
  countPresets: "cp_count_presets",
  posePresets: "cp_pose_presets",
  otherPresets: "cp_other_presets",
  settings: "cp_settings",
  gallery: "cp_gallery",
  variationTags: "cp_variation_tags",
  variationEnabled: "cp_variation_enabled",
  additionalPromptMode: "cp_additional_prompt_mode",
  batchPresetSets: "cp_batch_preset_sets",
};

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function submitPromptHttp(
  workflow: Record<string, unknown>,
  clientId: string,
): Promise<string> {
  const res = await fetch("/api/comfy/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.prompt_id as string;
}

async function listOutputFiles(subfolder: string): Promise<string[]> {
  try {
    const res = await fetch(
      `/api/comfy/output?subfolder=${encodeURIComponent(subfolder)}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.files || []) as string[];
  } catch {
    return [];
  }
}

async function pollForCompletion(
  promptId: string,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, 1500));
    if (signal.aborted) throw new Error("Cancelled");
    try {
      const res = await fetch(`/api/comfy/history?promptId=${promptId}`, {
        signal,
      });
      const data = await res.json();
      const item = data[promptId];
      if (item) {
        if (!item.status || item.status.status_str === "success") return;
        if (item.status.status_str === "error") {
          const msgs =
            (item.status.messages as string[][])?.flat().join(", ") ||
            "Generation failed";
          throw new Error(msgs);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new Error("Cancelled");
      if ((e as Error).message === "Cancelled") throw e;
      if ((e as Error).message.startsWith("Generation")) throw e;
    }
  }
  throw new Error("Cancelled");
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function usePipeline() {
  const [clientId] = useState(() => crypto.randomUUID());

  // Persistent config
  const [variableLoras, setVariableLoras] = useState<LoraEntry[]>(() =>
    lsGet(LS.variableLoras, []),
  );
  const [selectedVariableLora, setSelectedVariableLora] =
    useState<LoraEntry | null>(null);
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
  const [selectedPhysicalIds, setSelectedPhysicalIds] = useState<string[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedCountId, setSelectedCountId] = useState<string | null>(null);
  const [selectedPoseId, setSelectedPoseId] = useState<string | null>(null);
  const [selectedOtherIds, setSelectedOtherIds] = useState<string[]>([]);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE);
  const [settings, setSettings] = useState<GenerationSettings>(() =>
    lsGet(LS.settings, DEFAULT_SETTINGS),
  );
  const [batchCount, setBatchCount] = useState(4);

  // Variation mode
  const [variationEnabled, setVariationEnabled] = useState(() =>
    lsGet(LS.variationEnabled, false),
  );
  const [variationTags, setVariationTags] = useState<string[]>(() =>
    lsGet(LS.variationTags, DEFAULT_COMPOSITION_TAGS),
  );
  const [additionalPromptMode, setAdditionalPromptMode] = useState<
    "all" | "random"
  >(() => lsGet(LS.additionalPromptMode, "all"));

  // Batch preset sets
  const [batchPresetSets, setBatchPresetSets] = useState<BatchPresetSet[]>(() =>
    lsGet(LS.batchPresetSets, []),
  );

  // Queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  queueRef.current = queue;

  // Runtime generation state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ value: 0, max: 0 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  // Images completed in the currently running job (persists after job finishes until next job starts)
  const [currentJobImages, setCurrentJobImages] = useState<GalleryImage[]>([]);

  // Gallery
  const [gallery, setGallery] = useState<GalleryImage[]>(() =>
    lsGet(LS.gallery, []),
  );

  // Processing coordination
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledItemIdRef = useRef<string | null>(null);

  // Persist changes
  useEffect(() => {
    lsSet(LS.variableLoras, variableLoras);
  }, [variableLoras]);
  useEffect(() => {
    lsSet(LS.physicalPresets, physicalPresets);
  }, [physicalPresets]);
  useEffect(() => {
    lsSet(LS.scenePresets, scenePresets);
  }, [scenePresets]);
  useEffect(() => {
    lsSet(LS.countPresets, countPresets);
  }, [countPresets]);
  useEffect(() => {
    lsSet(LS.posePresets, posePresets);
  }, [posePresets]);
  useEffect(() => {
    lsSet(LS.otherPresets, otherPresets);
  }, [otherPresets]);
  useEffect(() => {
    lsSet(LS.settings, settings);
  }, [settings]);
  useEffect(() => {
    lsSet(LS.gallery, gallery.slice(0, 300));
  }, [gallery]);
  useEffect(() => {
    lsSet(LS.variationTags, variationTags);
  }, [variationTags]);
  useEffect(() => {
    lsSet(LS.variationEnabled, variationEnabled);
  }, [variationEnabled]);
  useEffect(() => {
    lsSet(LS.additionalPromptMode, additionalPromptMode);
  }, [additionalPromptMode]);
  useEffect(() => {
    lsSet(LS.batchPresetSets, batchPresetSets);
  }, [batchPresetSets]);

  // WS: progress & preview only
  useComfyWS(clientId, {
    onProgress: (value, max) => setProgress({ value, max }),
    onPreview: (url) => setPreviewUrl(url),
    onStatusChange: (connected) => setWsConnected(connected),
  });

  const updateQueueItem = useCallback(
    (id: string, updates: Partial<QueueItem>) => {
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Queue processor
  // -------------------------------------------------------------------------
  const processQueueRef = useRef<(() => Promise<void>) | undefined>(undefined);

  processQueueRef.current = async () => {
    if (isProcessingRef.current) return;
    const pendingItem = queueRef.current.find((i) => i.status === "pending");
    if (!pendingItem) return;

    isProcessingRef.current = true;
    cancelledItemIdRef.current = null;
    setIsProcessing(true);
    setProgress({ value: 0, max: 0 });
    setPreviewUrl(null);
    setCurrentJobImages([]);

    updateQueueItem(pendingItem.id, {
      status: "running",
      currentBatch: 0,
      completedImages: [],
    });

    const allLoras: LoraEntry[] = [
      ...FIXED_LORAS,
      ...pendingItem.presetLoras,
      ...(pendingItem.variableLora ? [pendingItem.variableLora] : []),
    ];
    const outputPrefix = buildOutputPrefix(
      pendingItem.variableLora?.name || "no-lora",
    );
    const outputSubfolder = outputPrefix.split("/")[0];

    let failed = false;

    for (let batch = 0; batch < pendingItem.batchCount; batch++) {
      if (cancelledItemIdRef.current === pendingItem.id) {
        updateQueueItem(pendingItem.id, { status: "cancelled" });
        cancelledItemIdRef.current = null;
        failed = true;
        break;
      }

      // Additional prompt: pick per-batch if random mode
      let pickedAdditional: string | undefined;
      let batchBasePrompt: string;
      if (
        pendingItem.additionalPromptMode === "random" &&
        pendingItem.additionalPromptLines.length > 0
      ) {
        pickedAdditional =
          pendingItem.additionalPromptLines[
            Math.floor(Math.random() * pendingItem.additionalPromptLines.length)
          ];
        batchBasePrompt = pickedAdditional
          ? `${pendingItem.positivePromptBase}\n\n${pickedAdditional}`
          : pendingItem.positivePromptBase;
      } else {
        batchBasePrompt = pendingItem.positivePrompt;
        pickedAdditional =
          pendingItem.additionalPromptLines.length > 0
            ? pendingItem.additionalPromptLines.join("\n")
            : undefined;
      }

      // Variation: randomly pick a composition tag if enabled for this item
      let batchPrompt = batchBasePrompt;
      if (pendingItem.variationTags.length > 0) {
        const tag =
          pendingItem.variationTags[
            Math.floor(Math.random() * pendingItem.variationTags.length)
          ];
        batchPrompt = `${batchBasePrompt}\n\n${tag}`;
      }

      const workflow = buildWorkflow({
        settings: pendingItem.settings,
        loras: allLoras,
        positivePrompt: batchPrompt,
        negativePrompt: pendingItem.negativePrompt,
        outputPrefix,
      });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const filesBefore = await listOutputFiles(outputSubfolder);
        const promptId = await submitPromptHttp(workflow, clientId);
        await pollForCompletion(promptId, abortController.signal);

        const filesAfter = await listOutputFiles(outputSubfolder);
        const newFiles = filesAfter.filter((f) => !filesBefore.includes(f));

        const newImages: GalleryImage[] = newFiles.map((filename) => ({
          path: `${outputSubfolder}/${filename}`,
          loraName: pendingItem.variableLora?.name || "no-lora",
          positivePrompt: batchPrompt,
          queueLabel: pendingItem.label,
          createdAt: Date.now(),
          appliedAdditional: pickedAdditional,
        }));

        if (newImages.length > 0) {
          setGallery((prev) => [...newImages, ...prev]);
          setCurrentJobImages((prev) => [...prev, ...newImages]);
          setQueue((prev) =>
            prev.map((item) =>
              item.id === pendingItem.id
                ? {
                    ...item,
                    completedImages: [...item.completedImages, ...newImages],
                  }
                : item,
            ),
          );
        }

        updateQueueItem(pendingItem.id, { currentBatch: batch + 1 });
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === "Cancelled") {
          updateQueueItem(pendingItem.id, { status: "cancelled" });
          cancelledItemIdRef.current = null;
        } else {
          console.error(`[pipeline] batch ${batch} error:`, msg);
          updateQueueItem(pendingItem.id, { status: "failed" });
        }
        failed = true;
        break;
      } finally {
        abortControllerRef.current = null;
      }
    }

    if (!failed) {
      updateQueueItem(pendingItem.id, { status: "completed" });
    }

    isProcessingRef.current = false;
    setIsProcessing(false);

    setTimeout(() => processQueueRef.current?.(), 100);
  };

  useEffect(() => {
    if (!isProcessingRef.current && queue.some((i) => i.status === "pending")) {
      processQueueRef.current?.();
    }
  }, [queue]);

  // -------------------------------------------------------------------------
  // Queue actions
  // -------------------------------------------------------------------------

  const addToQueue = useCallback(() => {
    const selectedPhysicals = physicalPresets.filter((p) =>
      selectedPhysicalIds.includes(p.id),
    );
    const selectedScene =
      scenePresets.find((p) => p.id === selectedSceneId) ?? null;
    const selectedCount =
      countPresets.find((p) => p.id === selectedCountId) ?? null;
    const selectedPose =
      posePresets.find((p) => p.id === selectedPoseId) ?? null;
    const selectedOthers = otherPresets.filter((p) =>
      selectedOtherIds.includes(p.id),
    );

    const allSelectedPresets = [
      ...selectedPhysicals,
      ...(selectedCount ? [selectedCount] : []),
      ...(selectedPose ? [selectedPose] : []),
      ...(selectedScene ? [selectedScene] : []),
      ...selectedOthers,
    ];

    const positivePromptBase = assemblePositivePrompt({
      variableLora: selectedVariableLora,
      selectedPhysicalPresets: selectedPhysicals,
      selectedCountPreset: selectedCount,
      selectedPosePreset: selectedPose,
      selectedScenePreset: selectedScene,
      selectedOtherPresets: selectedOthers,
      additionalPrompt: "",
    });

    const additionalPromptLines = additionalPrompt
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const positivePrompt =
      additionalPromptLines.length > 0
        ? `${positivePromptBase}\n\n${additionalPrompt.trim()}`
        : positivePromptBase;

    const presetLoras = collectPresetLoras(allSelectedPresets);

    const label = selectedVariableLora
      ? (selectedVariableLora.name
          .split("/")
          .pop()
          ?.replace(".safetensors", "") ?? selectedVariableLora.name)
      : "(LoRAなし)";

    const item: QueueItem = {
      id: crypto.randomUUID(),
      label,
      variableLora: selectedVariableLora,
      presetLoras,
      positivePrompt,
      positivePromptBase,
      negativePrompt,
      settings: { ...settings },
      batchCount,
      status: "pending",
      currentBatch: 0,
      completedImages: [],
      variationTags: variationEnabled ? [...variationTags] : [],
      additionalPromptMode,
      additionalPromptLines,
      createdAt: Date.now(),
    };

    setQueue((prev) => [...prev, item]);
  }, [
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
    settings,
    batchCount,
    variationEnabled,
    variationTags,
  ]);

  const captureCurrentSettings = useCallback(
    (name: string): BatchPreset => {
      const selectedPhysicals = physicalPresets.filter((p) =>
        selectedPhysicalIds.includes(p.id),
      );
      const selectedScene =
        scenePresets.find((p) => p.id === selectedSceneId) ?? null;
      const selectedCount =
        countPresets.find((p) => p.id === selectedCountId) ?? null;
      const selectedPose =
        posePresets.find((p) => p.id === selectedPoseId) ?? null;
      const selectedOthers = otherPresets.filter((p) =>
        selectedOtherIds.includes(p.id),
      );
      return {
        id: crypto.randomUUID(),
        name,
        physicalPresets: selectedPhysicals,
        countPreset: selectedCount,
        posePreset: selectedPose,
        scenePreset: selectedScene,
        otherPresets: selectedOthers,
        additionalPrompt,
        additionalPromptMode,
        settings: { ...settings },
        variationEnabled,
        variationTags: [...variationTags],
        batchCount,
      };
    },
    [
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
      settings,
      variationEnabled,
      variationTags,
      batchCount,
    ],
  );

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

  const runBatchPresets = useCallback(
    (presets: BatchPreset[]) => {
      const items: QueueItem[] = presets.map((preset) => {
        const allSelectedPresets = [
          ...preset.physicalPresets,
          ...(preset.countPreset ? [preset.countPreset] : []),
          ...(preset.posePreset ? [preset.posePreset] : []),
          ...(preset.scenePreset ? [preset.scenePreset] : []),
          ...preset.otherPresets,
        ];

        const positivePromptBase = assemblePositivePrompt({
          variableLora: selectedVariableLora,
          selectedPhysicalPresets: preset.physicalPresets,
          selectedCountPreset: preset.countPreset,
          selectedPosePreset: preset.posePreset,
          selectedScenePreset: preset.scenePreset,
          selectedOtherPresets: preset.otherPresets,
          additionalPrompt: "",
        });

        const additionalPromptLines = preset.additionalPrompt
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);

        const positivePrompt =
          additionalPromptLines.length > 0
            ? `${positivePromptBase}\n\n${preset.additionalPrompt.trim()}`
            : positivePromptBase;

        const presetLoras = collectPresetLoras(allSelectedPresets);

        const loraLabel =
          selectedVariableLora?.name
            .split("/")
            .pop()
            ?.replace(".safetensors", "") ?? null;
        const label = [loraLabel, preset.name].filter(Boolean).join(" / ");

        return {
          id: crypto.randomUUID(),
          label: label || "(一括)",
          variableLora: selectedVariableLora,
          presetLoras,
          positivePrompt,
          positivePromptBase,
          negativePrompt,
          settings: { ...preset.settings },
          batchCount: preset.batchCount,
          status: "pending",
          currentBatch: 0,
          completedImages: [],
          variationTags: preset.variationEnabled
            ? [...preset.variationTags]
            : [],
          additionalPromptMode: preset.additionalPromptMode,
          additionalPromptLines,
          createdAt: Date.now(),
        };
      });
      setQueue((prev) => [...prev, ...items]);
    },
    [selectedVariableLora, negativePrompt],
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) =>
      prev.filter((item) => !(item.id === id && item.status !== "running")),
    );
  }, []);

  const cancelCurrent = useCallback(async () => {
    const running = queueRef.current.find((i) => i.status === "running");
    if (!running) return;
    cancelledItemIdRef.current = running.id;
    abortControllerRef.current?.abort();
    await fetch("/api/comfy/interrupt", { method: "POST" }).catch(() => {});
  }, []);

  // -------------------------------------------------------------------------
  // Export / Import
  // -------------------------------------------------------------------------

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
      variationTags,
      batchPresetSets,
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
    variationTags,
    batchPresetSets,
  ]);

  const importData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.version !== 1) throw new Error("Unsupported version");
        if (Array.isArray(data.variableLoras))
          setVariableLoras(data.variableLoras);
        if (Array.isArray(data.physicalPresets))
          setPhysicalPresets(data.physicalPresets);
        if (Array.isArray(data.scenePresets))
          setScenePresets(data.scenePresets);
        if (Array.isArray(data.countPresets))
          setCountPresets(data.countPresets);
        if (Array.isArray(data.posePresets)) setPosePresets(data.posePresets);
        if (Array.isArray(data.otherPresets))
          setOtherPresets(data.otherPresets);
        if (data.settings && typeof data.settings === "object")
          setSettings(data.settings);
        if (typeof data.negativePrompt === "string")
          setNegativePrompt(data.negativePrompt);
        if (Array.isArray(data.variationTags))
          setVariationTags(data.variationTags);
        if (Array.isArray(data.batchPresetSets))
          setBatchPresetSets(data.batchPresetSets);
      } catch (err) {
        console.error("[pipeline] Import failed:", err);
      }
    };
    reader.readAsText(file);
  }, []);

  // -------------------------------------------------------------------------
  // LoRA management
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Preset management
  // -------------------------------------------------------------------------

  const addPreset = useCallback((preset: Omit<Preset, "id">) => {
    const newPreset: Preset = { ...preset, id: crypto.randomUUID() };
    if (preset.type === "physical")
      setPhysicalPresets((prev) => [...prev, newPreset]);
    else if (preset.type === "scene")
      setScenePresets((prev) => [...prev, newPreset]);
    else if (preset.type === "count")
      setCountPresets((prev) => [...prev, newPreset]);
    else if (preset.type === "pose")
      setPosePresets((prev) => [...prev, newPreset]);
    else setOtherPresets((prev) => [...prev, newPreset]);
  }, []);

  const updatePreset = useCallback((id: string, updates: Partial<Preset>) => {
    const upd = (p: Preset) => (p.id === id ? { ...p, ...updates } : p);
    setPhysicalPresets((prev) => prev.map(upd));
    setScenePresets((prev) => prev.map(upd));
    setCountPresets((prev) => prev.map(upd));
    setPosePresets((prev) => prev.map(upd));
    setOtherPresets((prev) => prev.map(upd));
  }, []);

  const removePreset = useCallback((id: string) => {
    setPhysicalPresets((prev) => prev.filter((p) => p.id !== id));
    setScenePresets((prev) => prev.filter((p) => p.id !== id));
    setCountPresets((prev) => prev.filter((p) => p.id !== id));
    setPosePresets((prev) => prev.filter((p) => p.id !== id));
    setOtherPresets((prev) => prev.filter((p) => p.id !== id));
    setSelectedPhysicalIds((prev) => prev.filter((pid) => pid !== id));
    setSelectedSceneId((prev) => (prev === id ? null : prev));
    setSelectedCountId((prev) => (prev === id ? null : prev));
    setSelectedPoseId((prev) => (prev === id ? null : prev));
    setSelectedOtherIds((prev) => prev.filter((pid) => pid !== id));
  }, []);

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

  // -------------------------------------------------------------------------
  // Gallery
  // -------------------------------------------------------------------------

  const clearGallery = useCallback(() => setGallery([]), []);

  const refreshGalleryFromFs = useCallback(async () => {
    const res = await fetch("/api/comfy/output").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    const dirs = (data.dirs || []) as string[];

    const newImages: GalleryImage[] = [];
    for (const dir of dirs.slice(0, 30)) {
      const files = await listOutputFiles(dir);
      for (const file of files) {
        newImages.push({
          path: `${dir}/${file}`,
          loraName: dir.replace(/^\d{8}-/, ""),
          positivePrompt: "",
          queueLabel: dir,
          createdAt: Date.now(),
        });
      }
    }

    setGallery(newImages.reverse());
  }, []);

  return {
    clientId,
    // Config
    variableLoras,
    selectedVariableLora,
    setSelectedVariableLora,
    physicalPresets,
    scenePresets,
    countPresets,
    posePresets,
    otherPresets,
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
    additionalPrompt,
    setAdditionalPrompt,
    negativePrompt,
    setNegativePrompt,
    settings,
    setSettings,
    batchCount,
    setBatchCount,
    // Variation mode
    variationEnabled,
    setVariationEnabled,
    variationTags,
    setVariationTags,
    additionalPromptMode,
    setAdditionalPromptMode,
    // Batch preset sets
    batchPresetSets,
    captureCurrentSettings,
    saveBatchPresetSet,
    removeBatchPresetSet,
    runBatchPresets,
    // Queue
    queue,
    addToQueue,
    removeFromQueue,
    cancelCurrent,
    // Runtime
    isProcessing,
    wsConnected,
    progress,
    previewUrl,
    currentJobImages,
    // Gallery
    gallery,
    clearGallery,
    refreshGalleryFromFs,
    // LoRA management
    addVariableLora,
    updateVariableLora,
    removeVariableLora,
    // Preset management
    addPreset,
    updatePreset,
    removePreset,
    // Export/Import
    exportData,
    importData,
  };
}
