"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  type LoraEntry,
  type GenerationSettings,
  type QueueItem,
  type GalleryImage,
  type BatchPreset,
  type BatchPresetSet,
  type BatchRunOverrides,
  collectPresetLoras,
  assemblePositivePrompt,
  buildWorkflow,
  buildOutputPrefix,
} from "@/lib/comfy";
import { buildCoupleWorkflow, buildColorMaskWorkflow } from "@/lib/couple";
import type { CoupleControlNet, CoupleRegion } from "@/lib/couple";
import { useComfyWS } from "./use-comfy-ws";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { lsGet, lsSet } from "@/hooks/ls";
import { useNormalMode } from "@/hooks/use-normal-mode";
import {
  submitPromptHttp,
  listOutputFiles,
  pollForCompletion,
} from "@/lib/comfy-client";
import { LS_GROUP_BY_POSE, type GenerationMode, type GalleryImageEntry } from "@/lib/gallery";

function migrateBatchPresetSets(raw: BatchPresetSet[]): BatchPresetSet[] {
  return raw.map((set) => ({
    ...set,
    presets: (set.presets as unknown as Record<string, unknown>[]).map((p) => {
      if ("countPreset" in p) {
        return {
          id: p.id as string,
          name: p.name as string,
          countPresetId: (p.countPreset as { id?: string } | null)?.id ?? null,
          posePresetId: (p.posePreset as { id?: string } | null)?.id ?? null,
          otherPresetIds: ((p.otherPresets as { id: string }[]) ?? []).map((op) => op.id),
          additionalPrompt: (p.additionalPrompt as string) ?? "",
          additionalPromptMode: (p.additionalPromptMode as "all" | "random") ?? "all",
          fixedTags: (p.fixedTags as string) ?? "",
          negativePrompt: (p.negativePrompt as string) ?? "",
          variationEnabled: (p.variationEnabled as boolean) ?? false,
          variationTags: (p.variationTags as string[]) ?? [],
          batchCount: (p.batchCount as number) ?? 1,
        };
      }
      return p as unknown as BatchPreset;
    }),
  }));
}

const LS = {
  settings: "cp_settings",
  batchCount: "cp_batch_count",
  gallery: "cp_gallery",
  panelSizes: "cp_panel_sizes",
  promptPreview: "cp_prompt_preview",
  queue: "cp_queue",
};

export type PromptPreviewPos = { x: number; y: number; collapsed: boolean; width?: number; height?: number };
const DEFAULT_PROMPT_PREVIEW: PromptPreviewPos = { x: -1, y: -1, collapsed: false };

// ---------------------------------------------------------------------------
// Core hook — composes useNormalMode + queue/WS/gallery/settings
// ---------------------------------------------------------------------------

export function usePipeline() {
  const normalMode = useNormalMode();
  const {
    fixedLoras,
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
    setFixedTags,
    setVariationTags,
    setBatchPresetSets,
    presetCategories,
    setPresetCategories,
  } = normalMode;

  const [clientId] = useState(() => crypto.randomUUID());

  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [batchCount, setBatchCount] = useState(4);
  const DEFAULT_PANEL_SIZES = { left: 28, center: 38, right: 34 };
  const [panelSizes, setPanelSizesState] = useState<Record<string, number>>(DEFAULT_PANEL_SIZES);
  const [promptPreviewPos, setPromptPreviewPosState] = useState<PromptPreviewPos>(DEFAULT_PROMPT_PREVIEW);
  const [pipelineLsLoaded, setPipelineLsLoaded] = useState(false);

  // Queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  queueRef.current = queue;

  useEffect(() => {
    setSettings(lsGet(LS.settings, DEFAULT_SETTINGS));
    setBatchCount(lsGet(LS.batchCount, 4));
    setPanelSizesState(lsGet(LS.panelSizes, DEFAULT_PANEL_SIZES));
    setPromptPreviewPosState(lsGet(LS.promptPreview, DEFAULT_PROMPT_PREVIEW));
    // A "running" item mid-generation at reload time has no way to actually
    // resume (the abort controller / WS connection are gone) — put it back
    // in the pending queue instead of leaving it stuck forever.
    const savedQueue = lsGet<QueueItem[]>(LS.queue, []);
    setQueue(
      savedQueue.map((item) =>
        item.status === "running"
          ? { ...item, status: "pending" as const, currentBatch: 0 }
          : item,
      ),
    );
    setPipelineLsLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setPanelSizes = useCallback((sizes: Record<string, number>) => {
    setPanelSizesState(sizes);
    lsSet(LS.panelSizes, sizes);
  }, []);
  const setPromptPreviewPos = useCallback((pos: PromptPreviewPos) => {
    setPromptPreviewPosState(pos);
    lsSet(LS.promptPreview, pos);
  }, []);

  // Queue must be started explicitly so items can be queued up (with tweaked
  // params) without kicking off generation until the user is ready.
  const [queueRunning, setQueueRunning] = useState(false);
  const queueRunningRef = useRef(false);
  queueRunningRef.current = queueRunning;

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
  // "reroll" = re-draw all randomness (preset/additional/variation) with a fresh seed.
  // "samePrompt" = keep the exact prompt already in flight, only change the seed.
  const redoModeRef = useRef<"reroll" | "samePrompt" | null>(null);

  // Current batch prompt (for preview display during generation)
  const [currentBatchPrompt, setCurrentBatchPrompt] = useState<string | null>(null);

  // Persist core state
  useEffect(() => { if (pipelineLsLoaded) lsSet(LS.settings, settings); }, [pipelineLsLoaded, settings]);
  useEffect(() => { if (pipelineLsLoaded) lsSet(LS.batchCount, batchCount); }, [pipelineLsLoaded, batchCount]);
  useEffect(() => { lsSet(LS.gallery, gallery.slice(0, 300)); }, [gallery]);
  useEffect(() => { if (pipelineLsLoaded) lsSet(LS.queue, queue); }, [pipelineLsLoaded, queue]);

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
    if (!queueRunningRef.current) return;
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
      pendingItem.filePrefix,
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
    let lastBatchPrompt: string | null = null;
    let lastPickedAdditional: string | undefined;
    let lastBatchAllLoras: LoraEntry[] | null = null;

    for (let batch = 0; batch < pendingItem.batchCount; batch++) {
      if (cancelledItemIdRef.current === pendingItem.id) {
        updateQueueItem(pendingItem.id, { status: "cancelled" });
        cancelledItemIdRef.current = null;
        failed = true;
        break;
      }

      const redoMode = redoModeRef.current;
      redoModeRef.current = null;
      const forceNewSeed = redoMode !== null;

      let batchPrompt: string;
      let pickedAdditional: string | undefined;
      let batchAllLoras: LoraEntry[];

      if (redoMode === "samePrompt" && lastBatchPrompt !== null) {
        batchPrompt = lastBatchPrompt;
        pickedAdditional = lastPickedAdditional;
        batchAllLoras = lastBatchAllLoras!;
      } else {
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
            fixedLoras,
            selectedPhysicalPresets: batchPhysicals,
            selectedCountPreset: batchCount,
            selectedPosePreset: batchPose,
            selectedScenePreset: batchScene,
            selectedOtherPresets: batchOthers,
            additionalPrompt: "",
            fixedPrefix: pendingItem.fixedTags,
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

        batchAllLoras = [
          ...fixedLoras,
          ...batchPresetLoras,
          ...(pendingItem.variableLora && !pendingItem.variableLora.isPromptOnly
            ? [pendingItem.variableLora]
            : []),
        ];

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

        batchPrompt = promptWithAdditional;
        if (pendingItem.variationTags.length > 0) {
          const tag =
            pendingItem.variationTags[
              Math.floor(Math.random() * pendingItem.variationTags.length)
            ];
          batchPrompt = `${promptWithAdditional}\n\n${tag}`;
        }

        lastBatchPrompt = batchPrompt;
        lastPickedAdditional = pickedAdditional;
        lastBatchAllLoras = batchAllLoras;
      }

      setCurrentBatchPrompt(batchPrompt);

      const workflowArgs = {
        settings: forceNewSeed
          ? { ...pendingItem.settings, randomizeSeed: true }
          : pendingItem.settings,
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
        const promptId = await submitPromptHttp(workflow, clientId, abortController.signal);
        await pollForCompletion(promptId, abortController.signal);

        const filesAfter = await listOutputFiles(outputSubfolder);
        const newFiles = filesAfter.filter((f) => !filesBefore.includes(f));

        // Fire-and-forget: save generated files to local COMFYUI_OUTPUT_DIR
        if (newFiles.length > 0) {
          fetch("/api/comfy/output/save-remote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paths: newFiles.map((f) => `${outputSubfolder}/${f}`),
            }),
          }).catch(() => {});
        }

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

        // Fire-and-forget: persist prompt/seed metadata as a JSON sidecar next
        // to each output file (there is no DB — the sidecar is the only
        // durable record of the prompt used, since gallery FS-rescans can't
        // recover it otherwise).
        if (newImages.length > 0) {
          const mode: GenerationMode = pendingItem.colorMaskWorkflow
            ? "colorMask"
            : pendingItem.coupleWorkflow
              ? "couple"
              : "normal";
          for (const img of newImages) {
            fetch("/api/gallery/metadata", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                path: img.path,
                metadata: {
                  mode,
                  loraName: img.loraName,
                  positivePrompt: img.positivePrompt,
                  negativePrompt: img.negativePrompt,
                  settings: img.settings,
                  loras: img.loras,
                  queueLabel: img.queueLabel,
                  createdAt: img.createdAt,
                  appliedAdditional: img.appliedAdditional,
                  ...(mode === "colorMask"
                    ? {
                        colorMaskControlNet: pendingItem.colorMaskControlNet,
                        colorMaskRegions: pendingItem.colorMaskRegions,
                      }
                    : {}),
                },
              }),
            }).catch(() => {});
          }
        }

        if (newImages.length > 0) {
          setGallery((prev) => [...newImages, ...prev]);
          setCurrentJobImages((prev) => {
            const existingPaths = new Set(prev.map((img) => img.path));
            const deduped = newImages.filter((img) => !existingPaths.has(img.path));
            return deduped.length > 0 ? [...prev, ...deduped] : prev;
          });
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
          if (redoModeRef.current) {
            abortControllerRef.current = null;
            batch--;
            continue;
          }
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
    setCurrentBatchPrompt(null);

    if (queueRunningRef.current) {
      setTimeout(() => processQueueRef.current?.(), 100);
    }
  };

  useEffect(() => {
    if (
      queueRunning &&
      !isProcessingRef.current &&
      queue.some((i) => i.status === "pending")
    ) {
      processQueueRef.current?.();
    }
  }, [queue, queueRunning]);

  const startQueue = useCallback(() => {
    setQueueRunning(true);
  }, []);

  const pauseQueue = useCallback(() => {
    setQueueRunning(false);
  }, []);

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
      fixedLoras,
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
      fixedTags,
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
      const selectedCount = countPresets.find((p) => p.id === selectedCountId) ?? null;
      const selectedPose = posePresets.find((p) => p.id === selectedPoseId) ?? null;
      const selectedOthers = otherPresets.filter((p) =>
        selectedOtherIds.includes(p.id),
      );

      let resolvedName = name;
      if (!resolvedName) {
        const parts: string[] = [];
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
        countPresetId: selectedCountId,
        posePresetId: selectedPoseId,
        otherPresetIds: [...selectedOtherIds],
        additionalPrompt,
        additionalPromptMode,
        fixedTags,
        negativePrompt,
        variationEnabled,
        variationTags: [...variationTags],
        batchCount,
      };
    },
    [
      countPresets,
      posePresets,
      otherPresets,
      selectedCountId,
      selectedPoseId,
      selectedOtherIds,
      additionalPrompt,
      additionalPromptMode,
      fixedTags,
      negativePrompt,
      variationEnabled,
      variationTags,
      batchCount,
    ],
  );

  const runBatchPresets = useCallback(
    (presets: BatchPreset[], overrides: BatchRunOverrides) => {
      const items: QueueItem[] = presets.map((preset) => {
        // IDから最新のプリセット内容を解決
        const resolvedCount = countPresets.find((p) => p.id === preset.countPresetId) ?? null;
        const resolvedPose = posePresets.find((p) => p.id === preset.posePresetId) ?? null;
        const resolvedOthers = otherPresets.filter((p) => preset.otherPresetIds.includes(p.id));

        const allSelectedPresets = [
          ...overrides.physicalPresets,
          ...(resolvedCount ? [resolvedCount] : []),
          ...(resolvedPose ? [resolvedPose] : []),
          ...(overrides.scenePreset ? [overrides.scenePreset] : []),
          ...resolvedOthers,
        ];

        const presetFixedTags = fixedTags;
        const presetNegativePrompt = preset.negativePrompt ?? "";

        const positivePromptBase = assemblePositivePrompt({
          variableLora: overrides.variableLora,
          fixedLoras,
          selectedPhysicalPresets: overrides.physicalPresets,
          selectedCountPreset: resolvedCount,
          selectedPosePreset: resolvedPose,
          selectedScenePreset: overrides.scenePreset,
          selectedOtherPresets: resolvedOthers,
          additionalPrompt: "",
          fixedPrefix: presetFixedTags,
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
          overrides.variableLora?.name.split("/").pop()?.replace(".safetensors", "") ?? null;
        const label = [loraLabel, preset.name].filter(Boolean).join(" / ");

        return {
          id: crypto.randomUUID(),
          label: label || "(一括)",
          filePrefix: preset.name || undefined,
          variableLora: overrides.variableLora,
          presetLoras,
          positivePrompt,
          positivePromptBase,
          negativePrompt: presetNegativePrompt,
          settings: { ...overrides.settings },
          fixedTags: presetFixedTags,
          batchCount: preset.batchCount,
          status: "pending",
          currentBatch: 0,
          completedImages: [],
          variationTags: preset.variationEnabled ? [...preset.variationTags] : [],
          additionalPromptMode: preset.additionalPromptMode,
          additionalPromptLines,
          createdAt: Date.now(),
          batchPresets: {
            selectedPhysicals: overrides.physicalPresets,
            selectedCount: resolvedCount,
            selectedPose: resolvedPose,
            selectedScene: overrides.scenePreset,
            selectedOthers: resolvedOthers,
          },
        };
      });
      setQueue((prev) => [...prev, ...items]);
    },
    [countPresets, posePresets, otherPresets, fixedTags],
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
        fixedTags: "",
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

  // Move a pending item to the front of the queue so it's picked up next,
  // and (re)start processing so it actually runs.
  const runItemNext = useCallback((id: string) => {
    setQueue((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1 || prev[idx].status !== "pending") return prev;
      const item = prev[idx];
      const rest = prev.filter((i) => i.id !== id);
      return [item, ...rest];
    });
    setQueueRunning(true);
  }, []);

  // Re-queue a completed or cancelled item as a fresh pending item, re-drawing
  // any random elements (preset random lines, additional prompt random line,
  // variation tags) again when it runs. Seed follows whatever the item's
  // settings say (fixed stays fixed, random stays random) — original entry
  // stays in the log as history.
  const requeueItem = useCallback((id: string) => {
    setQueue((prev) => {
      const src = prev.find((i) => i.id === id);
      if (
        !src ||
        (src.status !== "completed" && src.status !== "cancelled")
      )
        return prev;
      const copy: QueueItem = {
        ...src,
        id: crypto.randomUUID(),
        status: "pending",
        currentBatch: 0,
        completedImages: [],
        createdAt: Date.now(),
      };
      return [...prev, copy];
    });
  }, []);

  const cancelCurrent = useCallback(async () => {
    const running = queueRef.current.find((i) => i.status === "running");
    if (!running) return;
    cancelledItemIdRef.current = running.id;
    abortControllerRef.current?.abort();
    await fetch("/api/comfy/interrupt", { method: "POST" }).catch(() => {});
  }, []);

  // Redo the batch currently in flight, re-drawing any random elements
  // (preset random lines, additional prompt random line, variation tags)
  // again, with a fresh seed.
  const redoCurrentReroll = useCallback(async () => {
    if (!isProcessingRef.current) return;
    redoModeRef.current = "reroll";
    abortControllerRef.current?.abort();
    await fetch("/api/comfy/interrupt", { method: "POST" }).catch(() => {});
  }, []);

  // Redo the batch currently in flight with the exact same prompt already
  // submitted (no re-drawing of randomness), only changing the seed.
  const redoCurrentSamePrompt = useCallback(async () => {
    if (!isProcessingRef.current) return;
    redoModeRef.current = "samePrompt";
    abortControllerRef.current?.abort();
    await fetch("/api/comfy/interrupt", { method: "POST" }).catch(() => {});
  }, []);

  const cancelAllPending = useCallback(() => {
    setQueue((prev) =>
      prev.map((item) =>
        item.status === "pending" ? { ...item, status: "cancelled" as const } : item,
      ),
    );
  }, []);

  const clearLog = useCallback(() => {
    setQueue((prev) =>
      prev.filter(
        (item) => item.status === "pending" || item.status === "running",
      ),
    );
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
      fixedTags,
      variationTags,
      batchPresetSets,
      presetCategories,
      panelSizes,
      promptPreviewPos,
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
      setNegativePrompt,
      setFixedTags,
      setVariationTags,
      setBatchPresetSets,
      setPresetCategories,
      setPanelSizes,
      setPromptPreviewPos,
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
      // /api/gallery/images はファイル名だけでなく<file>.jsonサイドカーの
      // プロンプト/設定メタデータも一緒に返す(use-gallery.tsの読み込みと共通)。
      // 1フォルダの取得が失敗しても他フォルダの表示を止めない(best-effort)
      const entries: GalleryImageEntry[] = await fetch(
        `/api/gallery/images?folder=${encodeURIComponent(dir)}`,
      )
        .then((r) => (r.ok ? r.json() : { images: [] }))
        .then((d) => d.images || [])
        .catch(() => []);

      for (const entry of entries) {
        const meta = entry.meta;
        newImages.push({
          path: entry.path,
          loraName: meta?.loraName ?? dir.replace(/^\d{8}-/, ""),
          positivePrompt: meta?.positivePrompt ?? "",
          negativePrompt: meta?.negativePrompt,
          settings: meta?.settings,
          loras: meta?.loras,
          queueLabel: meta?.queueLabel ?? dir,
          createdAt: meta?.createdAt ?? Date.now(),
          appliedAdditional: meta?.appliedAdditional,
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
    queueRunning,
    startQueue,
    pauseQueue,
    addToQueue,
    addCoupleToQueue,
    updateQueueItem,
    removeFromQueue,
    runItemNext,
    requeueItem,
    cancelCurrent,
    redoCurrentReroll,
    redoCurrentSamePrompt,
    cancelAllPending,
    clearLog,
    captureCurrentSettings,
    runBatchPresets,
    // Runtime
    isProcessing,
    wsConnected,
    progress,
    previewUrl,
    currentJobImages,
    currentBatchPrompt,
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
    promptPreviewPos,
    setPromptPreviewPos,
  };
}
