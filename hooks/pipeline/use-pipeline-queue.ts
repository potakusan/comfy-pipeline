"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  type LoraEntry,
  type GenerationSettings,
  type Preset,
  type QueueItem,
  type GalleryImage,
  type BatchPreset,
  type BatchRunOverrides,
  type BatchRunInfo,
  type VariableBindings,
  type VariableDefs,
  type ImageRef,
  type ImageRefPool,
  type AdetailerTarget,
  type RandomChoice,
  type GenerationRecipe,
  buildWorkflow,
  buildOutputPrefix,
} from "@/lib/comfy";
import { buildCoupleWorkflow, buildColorMaskWorkflow } from "@/lib/comfy/couple";
import type { CoupleControlNet, CoupleRegion } from "@/lib/comfy/couple";
import { useComfyWS } from "../use-comfy-ws";
import { lsGet, lsSet } from "@/hooks/ls";
import { submitAndAwaitNewFiles, classifyCancelError } from "@/lib/comfy/comfy-client";
import { apiFetch } from "@/lib/api-client";
import type { PresetGenerationStats } from "@/lib/gallery-preset-stats";
import {
  resolvePresetPromptAndLoras,
  buildPositivePromptWithAdditional,
} from "@/hooks/pipeline/pipeline-prompt-helpers";
import { resolveItemBatch, type ResolvedBatch } from "@/hooks/pipeline/resolve-batch";
import { saveBatchImages } from "@/hooks/pipeline/save-batch-images";
import { buildBatchQueueItems } from "@/hooks/pipeline/build-batch-items";

const LS_QUEUE = "cp_queue";

export interface PipelineQueueDeps {
  fixedLoras: LoraEntry[];
  selectedVariableLora: LoraEntry | null;
  physicalPresets: Preset[];
  scenePresets: Preset[];
  countPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  selectedPhysicalIds: string[];
  selectedSceneId: string | null;
  selectedCountId: string | null;
  selectedPoseId: string | null;
  selectedOtherIds: string[];
  additionalPrompt: string;
  additionalPromptMode: "all" | "random";
  negativePrompt: string;
  fixedTags: string;
  variationEnabled: boolean;
  variationTags: string[];
  settings: GenerationSettings;
  /** 左カラムの検出再描画(顔・手など)の対象。キュー登録時点のスナップショットを各アイテムに持たせる */
  adetailer: AdetailerTarget[];
  batchCount: number;
  variableDefs: VariableDefs;
  variableInputValues: VariableBindings;
  imageRef: ImageRef | null;
  imageRefPool: ImageRefPool | null;
  setGallery: (updater: (prev: GalleryImage[]) => GalleryImage[]) => void;
}

/** キュー処理本体(ジョブ実行ループ)とキュー操作(追加/削除/やり直し等)。 */
export function usePipelineQueue(deps: PipelineQueueDeps) {
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
    settings,
    adetailer,
    batchCount,
    variableDefs,
    variableInputValues,
    imageRef,
    imageRefPool,
    setGallery,
  } = deps;

  const [clientId] = useState(() => crypto.randomUUID());

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  queueRef.current = queue;

  const [queueLsLoaded, setQueueLsLoaded] = useState(false);
  useEffect(() => {
    // A "running" item mid-generation at reload time has no way to actually
    // resume (the abort controller / WS connection are gone) — put it back
    // in the pending queue instead of leaving it stuck forever.
    const savedQueue = lsGet<QueueItem[]>(LS_QUEUE, []);
    setQueue(
      savedQueue.map((item) =>
        item.status === "running"
          ? { ...item, status: "pending" as const, currentBatch: 0 }
          : item,
      ),
    );
    setQueueLsLoaded(true);
  }, []);
  useEffect(() => { if (queueLsLoaded) lsSet(LS_QUEUE, queue); }, [queueLsLoaded, queue]);

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

  // Processing coordination
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledItemIdRef = useRef<string | null>(null);
  // "reroll" = re-draw all randomness (preset/additional/variation) with a fresh seed.
  // "samePrompt" = keep the exact prompt already in flight, only change the seed.
  const redoModeRef = useRef<"reroll" | "samePrompt" | null>(null);
  // 次バッチ継続用のsetTimeoutハンドル。アンマウント後にprocessQueueRef経由でsetStateが
  // 呼ばれるのを防ぐため、unmount時にクリアする(下のuseEffect参照)。
  const nextQueueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (nextQueueTimerRef.current) clearTimeout(nextQueueTimerRef.current);
    };
  }, []);

  // Current batch prompt (for preview display during generation)
  const [currentBatchPrompt, setCurrentBatchPrompt] = useState<string | null>(null);
  // 実行中バッチで採用されたランダム抽選 / 下絵ファイル名(フローティングウィンドウ用)
  const [currentBatchRandomChoices, setCurrentBatchRandomChoices] = useState<
    RandomChoice[]
  >([]);
  const [currentBatchInitImageName, setCurrentBatchInitImageName] = useState<
    string | null
  >(null);

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

    // 構図プールに group はあるが staged names が空(別環境からインポートした
    // セット、ComfyUI の input を消した後 等)の場合はこの場で再ステージする。
    let itemPoolNames = pendingItem.imageRefPool?.names ?? [];
    if (pendingItem.imageRefPool && itemPoolNames.length === 0) {
      try {
        const staged = await apiFetch<{ names: string[] }>("/api/i2i/stage", {
          method: "POST",
          body: JSON.stringify({ group: pendingItem.imageRefPool.group }),
        });
        itemPoolNames = staged.names;
      } catch {
        // 再ステージ失敗時は下絵なし(txt2img)として続行する
      }
    }

    let failed = false;
    let lastBatchPrompt: string | null = null;
    let lastPickedAdditional: string | undefined;
    let lastBatchAllLoras: LoraEntry[] | null = null;
    let lastResolvedBindings: VariableBindings = {};
    let lastRandomChoices: RandomChoice[] = [];
    let lastRecipe: GenerationRecipe | undefined;
    // undefined = 未計算 / null = 計算済みで下絵なし / オブジェクト = 使用中の下絵
    let lastInitImage: { name: string; denoise: number } | null | undefined =
      undefined;

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
      let resolvedBindings: VariableBindings = {};
      let batchInitImage: { name: string; denoise: number } | undefined;
      let batchChoices: RandomChoice[] = [];
      let batchRecipe: GenerationRecipe | undefined;

      if (redoMode === "samePrompt" && lastBatchPrompt !== null) {
        batchPrompt = lastBatchPrompt;
        pickedAdditional = lastPickedAdditional;
        batchAllLoras = lastBatchAllLoras!;
        resolvedBindings = lastResolvedBindings;
        batchChoices = lastRandomChoices;
        batchRecipe = lastRecipe;
        // 「プロンプト固定でやり直し」は下絵も同じ1枚を使い回す。
        batchInitImage = lastInitImage ?? undefined;
      } else {
        const resolved = resolveItemBatch(pendingItem, fixedLoras, itemPoolNames);
        batchPrompt = resolved.batchPrompt;
        pickedAdditional = resolved.pickedAdditional;
        batchAllLoras = resolved.batchAllLoras;
        resolvedBindings = resolved.resolvedBindings;
        batchInitImage = resolved.batchInitImage;
        batchChoices = resolved.batchChoices;
        batchRecipe = resolved.batchRecipe;

        lastBatchPrompt = batchPrompt;
        lastPickedAdditional = pickedAdditional;
        lastBatchAllLoras = batchAllLoras;
        lastResolvedBindings = resolvedBindings;
        lastRandomChoices = batchChoices;
        lastRecipe = batchRecipe;
        lastInitImage = batchInitImage ?? null;
      }

      const resolvedBatch: ResolvedBatch = {
        batchPrompt,
        pickedAdditional,
        batchAllLoras,
        resolvedBindings,
        batchInitImage,
        batchChoices,
        batchRecipe,
      };

      setCurrentBatchPrompt(batchPrompt);
      setCurrentBatchRandomChoices(batchChoices);
      setCurrentBatchInitImageName(batchInitImage?.name ?? null);

      // 「やり直し(新しいseedで)」はseedPoolより常に優先する(ユーザーの明示操作のため)。
      // そうでなければ、seedPoolが設定されていればbatch番目のプールseedを固定で使う。
      const poolEntry = !forceNewSeed ? pendingItem.seedPool?.[batch] : undefined;
      const workflowArgs = {
        settings: forceNewSeed
          ? { ...pendingItem.settings, randomizeSeed: true }
          : poolEntry
            ? {
                ...pendingItem.settings,
                randomizeSeed: false,
                seed: poolEntry.seed,
                upscaleSeed: poolEntry.upscaleSeed ?? undefined,
              }
            : pendingItem.settings,
        loras: batchAllLoras,
        positivePrompt: batchPrompt,
        negativePrompt: pendingItem.negativePrompt,
        outputPrefix,
      };

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // buildColorMaskWorkflowはregionsが空だと例外を投げるため、
        // このtry内で構築して下のcatchでバッチ失敗として扱う
        const { workflow, seed: resolvedSeed, upscaleSeed: resolvedUpscaleSeed } =
          pendingItem.colorMaskWorkflow
            ? buildColorMaskWorkflow({
                ...workflowArgs,
                basePositivePrompt: batchPrompt,
                regions: pendingItem.colorMaskRegions ?? [],
                controlNet: pendingItem.colorMaskControlNet!,
              })
            : pendingItem.coupleWorkflow
              ? buildCoupleWorkflow(workflowArgs)
              : buildWorkflow({
                  ...workflowArgs,
                  initImage: batchInitImage,
                  adetailer: pendingItem.adetailer,
                });

        const newFiles = await submitAndAwaitNewFiles(
          workflow,
          outputSubfolder,
          clientId,
          abortController.signal,
        );

        // 実際にComfyUIへ送ったworkflowに埋め込まれたseed(resolvedSeed/resolvedUpscaleSeed)を
        // 保存する。pendingItem.settings.seedをそのまま使うと、randomizeSeed:trueの場合に
        // 実際の生成に使われた値と食い違ったメタデータになってしまう。
        const resolvedSettings: GenerationSettings = {
          ...pendingItem.settings,
          seed: resolvedSeed,
          upscaleSeed: resolvedUpscaleSeed ?? undefined,
        };
        const { images: newImages } = saveBatchImages(
          pendingItem,
          resolvedBatch,
          outputSubfolder,
          newFiles,
          resolvedSettings,
        );

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
        const outcome = classifyCancelError(e, !!redoModeRef.current);
        if (outcome === "retry") {
          abortControllerRef.current = null;
          batch--;
          continue;
        }
        if (outcome === "cancelled") {
          updateQueueItem(pendingItem.id, { status: "cancelled" });
          cancelledItemIdRef.current = null;
        } else {
          console.error(`[pipeline] batch ${batch} error:`, (e as Error).message);
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
    setCurrentBatchInitImageName(null);

    if (queueRunningRef.current) {
      nextQueueTimerRef.current = setTimeout(() => processQueueRef.current?.(), 100);
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

    const { positivePromptBase, presetLoras } = resolvePresetPromptAndLoras({
      variableLora: selectedVariableLora,
      fixedLoras,
      fixedPrefix: fixedTags,
      selectedPhysicalPresets: selectedPhysicals,
      selectedCountPreset: selectedCount,
      selectedPosePreset: selectedPose,
      selectedScenePreset: selectedScene,
      selectedOtherPresets: selectedOthers,
    });

    const { positivePrompt, additionalPromptLines } = buildPositivePromptWithAdditional(
      positivePromptBase,
      additionalPrompt,
    );

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
      adetailer: adetailer.map((t) => ({ ...t })),
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
      variableInputValues: { ...variableInputValues },
      variableDefs: { ...variableDefs },
      imageRef: imageRef ?? undefined,
      imageRefPool: imageRefPool ?? undefined,
    };

    setQueue((prev) => [...prev, item]);
    toast.success(`「${label}」をキューに追加しました`);
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
    fixedLoras,
    variableInputValues,
    variableDefs,
    imageRef,
    imageRefPool,
    adetailer,
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
        variableValues: { ...variableInputValues },
        imageRef: imageRef ?? undefined,
        imageRefPool: imageRefPool ?? undefined,
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
      variableInputValues,
      imageRef,
      imageRefPool,
    ],
  );

  const runBatchPresets = useCallback(
    async (presets: BatchPreset[], runOverrides: BatchRunOverrides) => {
      // 良品率調整(#58)がONのときだけ preset-stats を取得する。OFF(既定)なら
      // 重い全走査をスキップして即キュー追加する。
      let presetStats: Record<string, PresetGenerationStats> = {};
      if (runOverrides.applyReleaseRateAdjustment) {
        const tid = toast.loading("良品率データを集計中…");
        try {
          const res = await apiFetch<{ stats: Record<string, PresetGenerationStats> }>(
            "/api/gallery/preset-stats",
          );
          presetStats = res.stats;
          toast.dismiss(tid);
        } catch {
          // 集計取得に失敗しても、調整せず指定枚数のまま生成を続行する
          toast.dismiss(tid);
          toast.warning("良品率データを取得できませんでした。指定枚数のまま追加します");
        }
      }

      const batchRun: BatchRunInfo = {
        runId: crypto.randomUUID(),
        setId: runOverrides.batchSet?.id,
        setName: runOverrides.batchSet?.name,
        startedAt: Date.now(),
      };

      const items = buildBatchQueueItems(presets, runOverrides, batchRun, {
        countPresets,
        posePresets,
        otherPresets,
        fixedTags,
        fixedLoras,
        variableDefs,
        adetailer,
        presetStats,
      });
      setQueue((prev) => [...prev, ...items]);
      if (items.length > 0) {
        toast.success(`${items.length}件のタスクをキューに追加しました`);
      }
    },
    [countPresets, posePresets, otherPresets, fixedTags, fixedLoras, variableDefs, adetailer],
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
      toast.success(`「${label}」をキューに追加しました`);
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

  return {
    clientId,
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
    isProcessing,
    wsConnected,
    progress,
    previewUrl,
    currentJobImages,
    currentBatchPrompt,
    currentBatchRandomChoices,
    currentBatchInitImageName,
  };
}
