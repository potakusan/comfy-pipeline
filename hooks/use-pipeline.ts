"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  type LoraEntry,
  type GenerationSettings,
  type QueueItem,
  type GalleryImage,
  type BatchPreset,
  collectPresetLoras,
  assemblePositivePrompt,
  buildWorkflow,
  buildOutputPrefix,
} from "@/lib/comfy";
import { buildCoupleWorkflow, buildColorMaskWorkflow } from "@/lib/couple";
import type { CoupleControlNet, CoupleRegion } from "@/lib/couple";
import { useComfyWS } from "./use-comfy-ws";
import { DEFAULT_SETTINGS, FIXED_LORAS } from "@/lib/config";
import { lsGet, lsSet } from "@/hooks/ls";
import { useNormalMode } from "@/hooks/use-normal-mode";

const LS = {
  settings: "cp_settings",
  batchCount: "cp_batch_count",
  gallery: "cp_gallery",
  panelSizes: "cp_panel_sizes",
};

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
// Core hook — composes useNormalMode + queue/WS/gallery/settings
// ---------------------------------------------------------------------------

export function usePipeline() {
  const normalMode = useNormalMode();
  const {
    variableLoras,
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
    batchPresetSets,
    setVariableLoras,
    setPhysicalPresets,
    setScenePresets,
    setCountPresets,
    setPosePresets,
    setOtherPresets,
    setNegativePrompt,
    setVariationTags,
    setBatchPresetSets,
    presetCategories,
    setPresetCategories,
  } = normalMode;

  const [clientId] = useState(() => crypto.randomUUID());

  const [settings, setSettings] = useState<GenerationSettings>(() =>
    lsGet(LS.settings, DEFAULT_SETTINGS),
  );
  const [batchCount, setBatchCount] = useState(() => lsGet(LS.batchCount, 4));
  const [panelSizes, setPanelSizesState] = useState<Record<string, number>>(
    () => lsGet(LS.panelSizes, { left: 28, center: 38, right: 34 }),
  );
  const setPanelSizes = useCallback((sizes: Record<string, number>) => {
    setPanelSizesState(sizes);
    lsSet(LS.panelSizes, sizes);
  }, []);

  // Queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  queueRef.current = queue;

  // Runtime generation state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ value: 0, max: 0 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [currentJobImages, setCurrentJobImages] = useState<GalleryImage[]>([]);

  // Gallery
  const [gallery, setGallery] = useState<GalleryImage[]>(() =>
    lsGet(LS.gallery, []),
  );

  // Processing coordination
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledItemIdRef = useRef<string | null>(null);

  // Persist core state
  useEffect(() => { lsSet(LS.settings, settings); }, [settings]);
  useEffect(() => { lsSet(LS.batchCount, batchCount); }, [batchCount]);
  useEffect(() => { lsSet(LS.gallery, gallery.slice(0, 300)); }, [gallery]);

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

    const outputPrefix = buildOutputPrefix(
      pendingItem.variableLora?.name || "no-lora",
    );
    const outputSubfolder = outputPrefix.split("/")[0];

    const resolvePreset = (p: import("@/lib/comfy").Preset): import("@/lib/comfy").Preset => {
      if (p.promptMode !== "random") return p;
      const lines = p.prompt.split("\n").filter((s) => s.trim());
      if (!lines.length) return p;
      return { ...p, prompt: lines[Math.floor(Math.random() * lines.length)] };
    };

    const bp = pendingItem.batchPresets;
    const anyPresetRandom = [
      ...bp.selectedPhysicals,
      ...(bp.selectedCount ? [bp.selectedCount] : []),
      ...(bp.selectedPose ? [bp.selectedPose] : []),
      ...(bp.selectedScene ? [bp.selectedScene] : []),
      ...bp.selectedOthers,
    ].some((p) => p.promptMode === "random");

    let failed = false;

    for (let batch = 0; batch < pendingItem.batchCount; batch++) {
      if (cancelledItemIdRef.current === pendingItem.id) {
        updateQueueItem(pendingItem.id, { status: "cancelled" });
        cancelledItemIdRef.current = null;
        failed = true;
        break;
      }

      let presetBase: string;
      let batchPresetLoras: LoraEntry[];

      if (anyPresetRandom) {
        const batchPhysicals = bp.selectedPhysicals.map(resolvePreset);
        const batchCount = bp.selectedCount ? resolvePreset(bp.selectedCount) : null;
        const batchPose = bp.selectedPose ? resolvePreset(bp.selectedPose) : null;
        const batchScene = bp.selectedScene ? resolvePreset(bp.selectedScene) : null;
        const batchOthers = bp.selectedOthers.map(resolvePreset);

        presetBase = assemblePositivePrompt({
          variableLora: pendingItem.variableLora,
          selectedPhysicalPresets: batchPhysicals,
          selectedCountPreset: batchCount,
          selectedPosePreset: batchPose,
          selectedScenePreset: batchScene,
          selectedOtherPresets: batchOthers,
          additionalPrompt: "",
          fixedPrefix: fixedTags,
        });

        batchPresetLoras = collectPresetLoras([
          ...batchPhysicals,
          ...(batchCount ? [batchCount] : []),
          ...(batchPose ? [batchPose] : []),
          ...(batchScene ? [batchScene] : []),
          ...batchOthers,
        ]);
      } else {
        presetBase = pendingItem.positivePromptBase;
        batchPresetLoras = pendingItem.presetLoras;
      }

      const batchAllLoras: LoraEntry[] = [
        ...FIXED_LORAS,
        ...batchPresetLoras,
        ...(pendingItem.variableLora ? [pendingItem.variableLora] : []),
      ];

      let pickedAdditional: string | undefined;
      let promptWithAdditional: string;
      if (
        pendingItem.additionalPromptMode === "random" &&
        pendingItem.additionalPromptLines.length > 0
      ) {
        pickedAdditional =
          pendingItem.additionalPromptLines[
            Math.floor(Math.random() * pendingItem.additionalPromptLines.length)
          ];
        promptWithAdditional = pickedAdditional
          ? `${presetBase}\n\n${pickedAdditional}`
          : presetBase;
      } else if (pendingItem.additionalPromptLines.length > 0) {
        pickedAdditional = pendingItem.additionalPromptLines.join("\n");
        promptWithAdditional = `${presetBase}\n\n${pickedAdditional}`;
      } else {
        promptWithAdditional = presetBase;
      }

      let batchPrompt = promptWithAdditional;
      if (pendingItem.variationTags.length > 0) {
        const tag =
          pendingItem.variationTags[
            Math.floor(Math.random() * pendingItem.variationTags.length)
          ];
        batchPrompt = `${promptWithAdditional}\n\n${tag}`;
      }

      const workflowArgs = {
        settings: pendingItem.settings,
        loras: batchAllLoras,
        positivePrompt: batchPrompt,
        negativePrompt: pendingItem.negativePrompt,
        outputPrefix,
      };
      const workflow = pendingItem.colorMaskWorkflow
        ? buildColorMaskWorkflow({
            ...workflowArgs,
            basePositivePrompt: batchPrompt,
            regions: pendingItem.colorMaskRegions ?? [],
            controlNet: pendingItem.colorMaskControlNet!,
          })
        : pendingItem.coupleWorkflow
          ? buildCoupleWorkflow(workflowArgs)
          : buildWorkflow(workflowArgs);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const filesBefore = await listOutputFiles(outputSubfolder);
        const promptId = await submitPromptHttp(workflow, clientId);
        await pollForCompletion(promptId, abortController.signal);

        const filesAfter = await listOutputFiles(outputSubfolder);
        const newFiles = filesAfter.filter((f) => !filesBefore.includes(f));

        const newImages: GalleryImage[] = newFiles.map((filename) => ({
          id: crypto.randomUUID(),
          path: `${outputSubfolder}/${filename}`,
          loraName: pendingItem.variableLora?.name || "no-lora",
          positivePrompt: batchPrompt,
          negativePrompt: pendingItem.negativePrompt,
          settings: { ...pendingItem.settings },
          loras: batchAllLoras,
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
                ? { ...item, completedImages: [...item.completedImages, ...newImages] }
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
    const selectedScene = scenePresets.find((p) => p.id === selectedSceneId) ?? null;
    const selectedCount = countPresets.find((p) => p.id === selectedCountId) ?? null;
    const selectedPose = posePresets.find((p) => p.id === selectedPoseId) ?? null;
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
      fixedPrefix: fixedTags,
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
      batchPresets: {
        selectedPhysicals,
        selectedCount,
        selectedPose,
        selectedScene,
        selectedOthers,
      },
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
    fixedTags,
  ]);

  const captureCurrentSettings = useCallback(
    (name?: string): BatchPreset => {
      const selectedPhysicals = physicalPresets.filter((p) =>
        selectedPhysicalIds.includes(p.id),
      );
      const selectedScene = scenePresets.find((p) => p.id === selectedSceneId) ?? null;
      const selectedCount = countPresets.find((p) => p.id === selectedCountId) ?? null;
      const selectedPose = posePresets.find((p) => p.id === selectedPoseId) ?? null;
      const selectedOthers = otherPresets.filter((p) =>
        selectedOtherIds.includes(p.id),
      );

      let resolvedName = name;
      if (!resolvedName) {
        const parts: string[] = [];
        if (selectedScene) parts.push(selectedScene.name);
        if (selectedPose) parts.push(selectedPose.name);
        if (selectedCount) parts.push(selectedCount.name);
        if (parts.length === 0) {
          const now = new Date();
          parts.push(
            `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
          );
        }
        resolvedName = parts.join(" · ");
      }

      return {
        id: crypto.randomUUID(),
        name: resolvedName,
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
          fixedPrefix: fixedTags,
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
          selectedVariableLora?.name.split("/").pop()?.replace(".safetensors", "") ?? null;
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
          variationTags: preset.variationEnabled ? [...preset.variationTags] : [],
          additionalPromptMode: preset.additionalPromptMode,
          additionalPromptLines,
          createdAt: Date.now(),
          batchPresets: {
            selectedPhysicals: preset.physicalPresets,
            selectedCount: preset.countPreset,
            selectedPose: preset.posePreset,
            selectedScene: preset.scenePreset,
            selectedOthers: preset.otherPresets,
          },
        };
      });
      setQueue((prev) => [...prev, ...items]);
    },
    [selectedVariableLora, negativePrompt],
  );

  const addCoupleToQueue = useCallback(
    ({
      positivePrompt,
      negativePrompt: coupleNeg,
      loras,
      coupleSettings,
      coupleBatchCount,
      label,
      colorMaskControlNet,
      colorMaskRegions,
    }: {
      positivePrompt: string;
      negativePrompt: string;
      loras: LoraEntry[];
      coupleSettings: GenerationSettings;
      coupleBatchCount: number;
      label: string;
      colorMaskControlNet?: CoupleControlNet;
      colorMaskRegions?: CoupleRegion[];
    }) => {
      const useColorMask = !!(colorMaskControlNet?.enabled && colorMaskControlNet.colorMapImageName);
      const item: QueueItem = {
        id: crypto.randomUUID(),
        label,
        variableLora: null,
        presetLoras: loras,
        positivePrompt,
        positivePromptBase: positivePrompt,
        negativePrompt: coupleNeg,
        settings: { ...coupleSettings },
        batchCount: coupleBatchCount,
        status: "pending",
        currentBatch: 0,
        completedImages: [],
        variationTags: [],
        additionalPromptMode: "all",
        additionalPromptLines: [],
        createdAt: Date.now(),
        batchPresets: {
          selectedPhysicals: [],
          selectedCount: null,
          selectedPose: null,
          selectedScene: null,
          selectedOthers: [],
        },
        coupleWorkflow: !useColorMask,
        colorMaskWorkflow: useColorMask,
        colorMaskControlNet: useColorMask ? colorMaskControlNet : undefined,
        colorMaskRegions: useColorMask ? colorMaskRegions : undefined,
      };
      setQueue((prev) => [...prev, item]);
    },
    [],
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
      presetCategories,
      panelSizes,
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
    presetCategories,
    panelSizes,
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
          if (Array.isArray(data.variationTags)) setVariationTags(data.variationTags);
          if (Array.isArray(data.batchPresetSets)) setBatchPresetSets(data.batchPresetSets);
          if (Array.isArray(data.presetCategories)) setPresetCategories(data.presetCategories);
          if (data.panelSizes && typeof data.panelSizes === "object") setPanelSizes(data.panelSizes);
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
      setNegativePrompt,
      setVariationTags,
      setBatchPresetSets,
      setPresetCategories,
      setPanelSizes,
    ],
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
    ...normalMode,
    clientId,
    // Settings
    settings,
    setSettings,
    batchCount,
    setBatchCount,
    // Queue
    queue,
    addToQueue,
    addCoupleToQueue,
    removeFromQueue,
    cancelCurrent,
    captureCurrentSettings,
    runBatchPresets,
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
    // Export/Import
    exportData,
    importData,
    // Layout
    panelSizes,
    setPanelSizes,
  };
}
