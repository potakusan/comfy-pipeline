"use client";
import { useNormalMode } from "@/hooks/pipeline/use-normal-mode";
import { usePipelineSettings } from "@/hooks/pipeline/use-pipeline-settings";
import { usePipelineSessionGallery } from "@/hooks/pipeline/use-pipeline-session-gallery";
import { usePipelineQueue } from "@/hooks/pipeline/use-pipeline-queue";
import { usePipelineIO } from "@/hooks/pipeline/use-pipeline-io";

export type { PromptPreviewPos } from "@/hooks/pipeline/use-pipeline-settings";

// ---------------------------------------------------------------------------
// Core hook — composes useNormalMode + settings/queue/gallery/io sub-hooks
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

  const pipelineSettings = usePipelineSettings();
  const { settings, setSettings, batchCount, setBatchCount, panelSizes, setPanelSizes, promptPreviewPos, setPromptPreviewPos, etaPos, setEtaPos } = pipelineSettings;

  const sessionGallery = usePipelineSessionGallery();
  const { gallery, setGallery, clearGallery, refreshGalleryFromFs } = sessionGallery;

  const queue = usePipelineQueue({
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
    batchCount,
    setGallery,
  });

  const io = usePipelineIO({
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
  });

  return {
    ...normalMode,
    // Settings
    settings,
    setSettings,
    batchCount,
    setBatchCount,
    // Queue
    clientId: queue.clientId,
    queue: queue.queue,
    queueRunning: queue.queueRunning,
    startQueue: queue.startQueue,
    pauseQueue: queue.pauseQueue,
    addToQueue: queue.addToQueue,
    addCoupleToQueue: queue.addCoupleToQueue,
    updateQueueItem: queue.updateQueueItem,
    removeFromQueue: queue.removeFromQueue,
    runItemNext: queue.runItemNext,
    requeueItem: queue.requeueItem,
    cancelCurrent: queue.cancelCurrent,
    redoCurrentReroll: queue.redoCurrentReroll,
    redoCurrentSamePrompt: queue.redoCurrentSamePrompt,
    cancelAllPending: queue.cancelAllPending,
    clearLog: queue.clearLog,
    captureCurrentSettings: queue.captureCurrentSettings,
    runBatchPresets: queue.runBatchPresets,
    // Runtime
    isProcessing: queue.isProcessing,
    wsConnected: queue.wsConnected,
    progress: queue.progress,
    previewUrl: queue.previewUrl,
    currentJobImages: queue.currentJobImages,
    currentBatchPrompt: queue.currentBatchPrompt,
    // Gallery
    gallery,
    clearGallery,
    refreshGalleryFromFs,
    // Export/Import
    exportData: io.exportData,
    importData: io.importData,
    // Layout
    panelSizes,
    setPanelSizes,
    promptPreviewPos,
    setPromptPreviewPos,
    etaPos,
    setEtaPos,
  };
}
