"use client";
import { useRef, useState, useMemo, useCallback } from "react";
import { usePipeline } from "@/hooks/pipeline/use-pipeline";
import { useCouple } from "@/hooks/pipeline/use-couple";
import { usePromptPreview } from "@/hooks/pipeline/use-prompt-preview";
import { useHomeKeyboardShortcuts } from "@/hooks/pipeline/use-home-keyboard-shortcuts";
import { useSysMonitor } from "@/hooks/use-sys-monitor";
import { resolveCouplePromptAndRegions } from "@/lib/comfy/couple";
import type { LoraEntry } from "@/lib/comfy";
import AppHeader from "@/components/common/app-header";
import HeaderStatus from "@/components/pipeline/home/header-status";
import LeftPanel from "@/components/pipeline/home/left-panel";
import CenterPanel from "@/components/pipeline/home/center-panel";
import RightPanel from "@/components/pipeline/home/right-panel";
import CancelGenerationDialog from "@/components/pipeline/home/cancel-generation-dialog";
import { ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import LeftIconNav, {
  type LeftSectionId,
} from "@/components/pipeline/left-icon-nav";
import EtaWindow from "@/components/pipeline/eta-window";
import PromptPreviewWindow from "@/components/pipeline/prompt-preview-window";
import SeedReferenceWindow from "@/components/pipeline/seed-reference-window";

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export default function Home() {
  const pipeline = usePipeline();
  const couple = useCouple();

  // Track which left-panel tab is active for queue dispatch
  const [leftTabMode, setLeftTabMode] = useState<"normal" | "couple">("normal");

  // Left icon nav: section refs + scroll handler
  const sectionRefs = useRef<
    Partial<Record<LeftSectionId, HTMLDivElement | null>>
  >({});
  const handleScrollTo = useCallback((id: LeftSectionId) => {
    if (id.startsWith("p-")) {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      sectionRefs.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);
  const registerSectionRef = useCallback(
    (id: LeftSectionId) => (el: HTMLDivElement | null) => {
      sectionRefs.current[id] = el;
    },
    [],
  );

  const { previewPositive, previewNegative, hasRandom, refreshPreview } =
    usePromptPreview(pipeline, couple, leftTabMode);

  // Unified "add to queue" that dispatches based on active mode
  const handleAddToQueue = () => {
    if (leftTabMode === "couple") {
      const { activeConfig, selectedNormalCountId, selectedNormalSceneId } =
        couple;
      const { positivePrompt, effectiveRegions, selectedScene } =
        resolveCouplePromptAndRegions({
          activeConfig,
          countPresetId: selectedNormalCountId,
          scenePresetId: selectedNormalSceneId,
          countPresets: pipeline.countPresets,
          scenePresets: pipeline.scenePresets,
          physicalPresets: pipeline.physicalPresets,
          posePresets: pipeline.posePresets,
          otherPresets: pipeline.otherPresets,
          fixedTags: pipeline.fixedTags,
        });
      const loras = activeConfig.regions
        .filter((r) => r.lora !== null)
        .map((r) => r.lora as LoraEntry);
      const label =
        activeConfig.name +
        (selectedScene ? ` / ${selectedScene.name}` : "") +
        (activeConfig.controlNet.enabled ? " [CN]" : "");
      pipeline.addCoupleToQueue({
        positivePrompt,
        negativePrompt: pipeline.negativePrompt,
        loras,
        coupleSettings: pipeline.settings,
        coupleBatchCount: pipeline.batchCount,
        label,
        colorMaskControlNet: activeConfig.controlNet,
        colorMaskRegions: effectiveRegions,
      });
    } else {
      pipeline.addToQueue();
    }
  };

  // Lifted so SamplerSettings' checkpoint quick-link can also open it
  const [modelManagerOpen, setModelManagerOpen] = useState(false);

  const addedLoraNames = useMemo(
    () => new Set(pipeline.variableLoras.map((l) => l.name)),
    [pipeline.variableLoras],
  );

  const { snapshots: gpuSnapshots } = useSysMonitor();

  const currentItem =
    pipeline.queue.find((i) => i.status === "running") ?? null;
  const pendingCount = pipeline.queue.filter(
    (i) => i.status === "pending",
  ).length;

  const { showCancelModal, setShowCancelModal } = useHomeKeyboardShortcuts(
    handleAddToQueue,
    currentItem,
  );

  const selectedCount =
    pipeline.selectedPhysicalIds.length +
    (pipeline.selectedSceneId ? 1 : 0) +
    (pipeline.selectedCountId ? 1 : 0) +
    (pipeline.selectedPoseId ? 1 : 0) +
    pipeline.selectedOtherIds.length +
    (pipeline.selectedVariableLora ? 1 : 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppHeader
        active="home"
        modelManagerOpen={modelManagerOpen}
        onModelManagerOpenChange={setModelManagerOpen}
        onAddLora={(entry) => pipeline.addVariableLora(entry)}
        onRemoveLora={(name) => {
          const idx = pipeline.variableLoras.findIndex((l) => l.name === name);
          if (idx !== -1) {
            pipeline.removeVariableLora(idx);
            if (pipeline.selectedVariableLora?.name === name)
              pipeline.setSelectedVariableLora(null);
          }
        }}
        onSelectCheckpoint={(fileName) =>
          pipeline.setSettings({ ...pipeline.settings, checkpoint: fileName })
        }
        addedLoraNames={addedLoraNames}
        activeCheckpoint={pipeline.settings.checkpoint}
      >
        <HeaderStatus pipeline={pipeline} pendingCount={pendingCount} />
      </AppHeader>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftIconNav activeTab={leftTabMode} onScrollTo={handleScrollTo} />
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <LeftPanel
            pipeline={pipeline}
            couple={couple}
            onLeftTabModeChange={setLeftTabMode}
            registerSectionRef={registerSectionRef}
            selectedCount={selectedCount}
            onOpenModelManager={() => setModelManagerOpen(true)}
          />

          <ResizableHandle withHandle />

          <CenterPanel
            pipeline={pipeline}
            currentItem={currentItem}
            onAddToQueue={handleAddToQueue}
          />

          <ResizableHandle withHandle />

          <RightPanel pipeline={pipeline} gpuSnapshots={gpuSnapshots} />
        </ResizablePanelGroup>
      </div>

      <EtaWindow
        queue={pipeline.queue}
        isProcessing={pipeline.isProcessing}
        currentJobImages={pipeline.currentJobImages}
        pos={pipeline.etaPos}
        onPosChange={pipeline.setEtaPos}
      />

      <PromptPreviewWindow
        positivePrompt={pipeline.currentBatchPrompt ?? previewPositive}
        negativePrompt={previewNegative}
        hasRandom={hasRandom}
        isLive={pipeline.isProcessing && pipeline.currentBatchPrompt !== null}
        onRefresh={refreshPreview}
        pos={pipeline.promptPreviewPos}
        onPosChange={pipeline.setPromptPreviewPos}
      />

      <SeedReferenceWindow
        queue={pipeline.queue}
        pos={pipeline.seedRefPos}
        onPosChange={pipeline.setSeedRefPos}
      />

      <CancelGenerationDialog
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        onConfirm={pipeline.cancelCurrent}
      />
    </div>
  );
}
