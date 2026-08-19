"use client";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { usePipeline } from "@/hooks/pipeline/use-pipeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Kbd } from "@/components/ui/kbd";
import LoraPanel from "@/components/pipeline/lora/lora-panel";
import PromptBuilder from "@/components/pipeline/prompt/prompt-builder";
import SamplerSettings from "@/components/pipeline/sampler-settings";
import TagSettings from "@/components/pipeline/prompt/tag-settings";
import CouplePanel from "@/components/pipeline/couple/couple-panel";
import { useCouple } from "@/hooks/pipeline/use-couple";
import { resolveCouplePromptAndRegions } from "@/lib/comfy/couple";
import { assemblePositivePrompt } from "@/lib/comfy";
import type { LoraEntry, Preset } from "@/lib/comfy";
import PreviewPanel from "@/components/pipeline/preview-panel";
import QueueManager from "@/components/pipeline/queue/queue-manager";
import GalleryPanel from "@/components/pipeline/gallery-panel";
import BatchQueueDialog from "@/components/pipeline/queue/batch-queue-dialog";
import QuickAddToBatch from "@/components/pipeline/queue/quick-add-to-batch";
import AppHeader from "@/components/common/app-header";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Wifi, WifiOff, Download, Upload } from "lucide-react";
import LeftIconNav, { type LeftSectionId } from "@/components/pipeline/left-icon-nav";
import Section from "@/components/pipeline/section";
import GpuMonitor from "@/components/pipeline/gpu-monitor";
import { useSysMonitor } from "@/hooks/use-sys-monitor";
import EtaWindow from "@/components/pipeline/eta-window";
import PromptPreviewWindow from "@/components/pipeline/prompt-preview-window";

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export default function Home() {
  const pipeline = usePipeline();
  const couple = useCouple();
  const {
    fixedLoras,
    addFixedLora,
    updateFixedLora,
    removeFixedLora,
    variableLoras,
    selectedVariableLora,
    setSelectedVariableLora,
    addVariableLora,
    updateVariableLora,
    removeVariableLora,
    setVariableLoraArchived,
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
    reorderPresets,
    selectedOtherIds,
    toggleOtherPreset,
    additionalPrompt,
    setAdditionalPrompt,
    negativePrompt,
    setNegativePrompt,
    fixedTags,
    setFixedTags,
    resetFixedTags,
    addPreset,
    updatePreset,
    removePreset,
    presetCategories,
    addCategory,
    renameCategory,
    removeCategory,
    settings,
    setSettings,
    batchCount,
    setBatchCount,
    variationEnabled,
    setVariationEnabled,
    variationTags,
    setVariationTags,
    additionalPromptMode,
    setAdditionalPromptMode,
    batchPresetSets,
    captureCurrentSettings,
    saveBatchPresetSet,
    removeBatchPresetSet,
    reorderBatchPresetSets,
    duplicateBatchPresetSet,
    runBatchPresets,
    queue,
    queueRunning,
    startQueue,
    pauseQueue,
    addToQueue,
    updateQueueItem,
    removeFromQueue,
    runItemNext,
    requeueItem,
    cancelCurrent,
    redoCurrentReroll,
    redoCurrentSamePrompt,
    cancelAllPending,
    clearLog,
    isProcessing,
    wsConnected,
    progress,
    previewUrl,
    currentJobImages,
    currentBatchPrompt,
    gallery,
    clearGallery,
    refreshGalleryFromFs,
    exportData,
    importData,
    panelSizes,
    setPanelSizes,
    promptPreviewPos,
    setPromptPreviewPos,
    etaPos,
    setEtaPos,
  } = pipeline;

  const importInputRef = useRef<HTMLInputElement>(null);

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

  // ---------------------------------------------------------------------------
  // Prompt preview
  // ---------------------------------------------------------------------------
  const [previewSeed, setPreviewSeed] = useState(0);
  const refreshPreview = useCallback(() => setPreviewSeed((s) => s + 1), []);

  const resolveRandom = useCallback((p: Preset): Preset => {
    if (p.promptMode !== "random") return p;
    const lines = p.prompt.split("\n").filter((s) => s.trim());
    if (!lines.length) return p;
    return { ...p, prompt: lines[Math.floor(Math.random() * lines.length)] };
  }, []);

  // Destructure individual stable fields from couple to avoid spurious useMemo re-runs
  // when the hook returns a new object reference on every parent render (e.g. GPU polling).
  const { activeConfig: coupleActiveConfig, selectedNormalCountId: coupleCountId, selectedNormalSceneId: coupleSceneId } = couple;

  const { previewPositive, previewNegative, hasRandom } = useMemo(() => {
    if (leftTabMode === "couple") {
      const { positivePrompt } = resolveCouplePromptAndRegions({
        activeConfig: coupleActiveConfig,
        countPresetId: coupleCountId,
        scenePresetId: coupleSceneId,
        countPresets,
        scenePresets,
        physicalPresets,
        posePresets,
        otherPresets,
        fixedTags,
      });
      return {
        previewPositive: positivePrompt,
        previewNegative: negativePrompt,
        hasRandom: false,
      };
    }

    const selPhysicals = physicalPresets
      .filter((p) => selectedPhysicalIds.includes(p.id))
      .map(resolveRandom);
    const selScene = scenePresets.find((p) => p.id === selectedSceneId);
    const selCount = countPresets.find((p) => p.id === selectedCountId);
    const selPose = posePresets.find((p) => p.id === selectedPoseId);
    const selOthers = otherPresets
      .filter((p) => selectedOtherIds.includes(p.id))
      .map(resolveRandom);

    const addLines = additionalPrompt
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    let previewAdditional = additionalPrompt.trim();
    if (additionalPromptMode === "random" && addLines.length > 0) {
      previewAdditional = addLines[Math.floor(Math.random() * addLines.length)];
    }

    const base = assemblePositivePrompt({
      variableLora: selectedVariableLora,
      fixedLoras,
      selectedPhysicalPresets: selPhysicals,
      selectedCountPreset: selCount ? resolveRandom(selCount) : null,
      selectedPosePreset: selPose ? resolveRandom(selPose) : null,
      selectedScenePreset: selScene ? resolveRandom(selScene) : null,
      selectedOtherPresets: selOthers,
      additionalPrompt: previewAdditional,
      fixedPrefix: fixedTags,
    });

    let previewPositive = base;
    if (variationEnabled && variationTags.length > 0) {
      const tag =
        variationTags[Math.floor(Math.random() * variationTags.length)];
      previewPositive = `${base}\n\n${tag}`;
    }

    const allSelected = [
      ...physicalPresets.filter((p) => selectedPhysicalIds.includes(p.id)),
      ...(selScene ? [selScene] : []),
      ...(selCount ? [selCount] : []),
      ...(selPose ? [selPose] : []),
      ...otherPresets.filter((p) => selectedOtherIds.includes(p.id)),
    ];
    const hasRandom =
      allSelected.some((p) => p.promptMode === "random") ||
      (additionalPromptMode === "random" && addLines.length > 1) ||
      variationEnabled;

    return { previewPositive, previewNegative: negativePrompt, hasRandom };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    previewSeed,
    leftTabMode,
    coupleActiveConfig,
    coupleCountId,
    coupleSceneId,
    fixedTags,
    fixedLoras,
    negativePrompt,
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
    selectedVariableLora,
    additionalPrompt,
    additionalPromptMode,
    variationEnabled,
    variationTags,
    resolveRandom,
  ]);

  // Unified "add to queue" that dispatches based on active mode
  const handleAddToQueue = () => {
    if (leftTabMode === "couple") {
      const { activeConfig, selectedNormalCountId, selectedNormalSceneId } =
        couple;
      const { positivePrompt, effectiveRegions, selectedScene } = resolveCouplePromptAndRegions({
        activeConfig,
        countPresetId: selectedNormalCountId,
        scenePresetId: selectedNormalSceneId,
        countPresets,
        scenePresets,
        physicalPresets,
        posePresets,
        otherPresets,
        fixedTags,
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
        negativePrompt,
        loras,
        coupleSettings: settings,
        coupleBatchCount: batchCount,
        label,
        colorMaskControlNet: activeConfig.controlNet,
        colorMaskRegions: effectiveRegions,
      });
    } else {
      addToQueue();
    }
  };

  // Cancel confirmation modal
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Lifted so SamplerSettings' checkpoint quick-link can also open it
  const [modelManagerOpen, setModelManagerOpen] = useState(false);

  const addedLoraNames = useMemo(
    () => new Set(variableLoras.map((l) => l.name)),
    [variableLoras],
  );

  // アーカイブ済みの可変LoRAはプリセット実行時（一括キュー実行前設定）の選択肢から除外する
  const nonArchivedVariableLoras = useMemo(
    () => variableLoras.filter((l) => !l.isArchived),
    [variableLoras],
  );

  // Stable ref so keyboard handler always calls the latest handleAddToQueue
  const addToQueueRef = useRef(handleAddToQueue);
  addToQueueRef.current = handleAddToQueue;

  // GPU monitor state
  const { snapshots: gpuSnapshots } = useSysMonitor();
  const [gpuCollapsed, setGpuCollapsed] = useState(false);

  const currentItem = queue.find((i) => i.status === "running") ?? null;
  const pendingCount = queue.filter((i) => i.status === "pending").length;

  // Keyboard shortcuts — placed after currentItem is declared
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Enter — add current settings to queue
      if (e.ctrlKey && e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        addToQueueRef.current();
        return;
      }
      // Esc — prompt to cancel the running job
      if (e.key === "Escape" && currentItem && !showCancelModal) {
        setShowCancelModal(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentItem, showCancelModal]);
  const selectedCount =
    selectedPhysicalIds.length +
    (selectedSceneId ? 1 : 0) +
    (selectedCountId ? 1 : 0) +
    (selectedPoseId ? 1 : 0) +
    selectedOtherIds.length +
    (selectedVariableLora ? 1 : 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppHeader
        active="home"
        modelManagerOpen={modelManagerOpen}
        onModelManagerOpenChange={setModelManagerOpen}
        onAddLora={(entry) => addVariableLora(entry)}
        onRemoveLora={(name) => {
          const idx = variableLoras.findIndex((l) => l.name === name);
          if (idx !== -1) {
            removeVariableLora(idx);
            if (selectedVariableLora?.name === name) setSelectedVariableLora(null);
          }
        }}
        onSelectCheckpoint={(fileName) =>
          setSettings({ ...settings, checkpoint: fileName })
        }
        addedLoraNames={addedLoraNames}
        activeCheckpoint={settings.checkpoint}
      >
        {wsConnected ? (
          <Wifi className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}

        {isProcessing ? (
          <Badge variant="default" className="gap-1.5 text-xs">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-300" />
            生成中
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            接続しました
          </Badge>
        )}
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            待機 {pendingCount}件
          </Badge>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={exportData}
          title="設定をエクスポート"
        >
          <Download className="h-3.5 w-3.5" />
          エクスポート
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => importInputRef.current?.click()}
          title="設定をインポート"
        >
          <Upload className="h-3.5 w-3.5" />
          インポート
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importData(file);
            e.target.value = "";
          }}
        />
      </AppHeader>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftIconNav activeTab={leftTabMode} onScrollTo={handleScrollTo} />
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel
            id="left"
            defaultSize={`${panelSizes["left"]}%`}
            minSize="15%"
            maxSize="45%"
            className="flex flex-col border-r"
            onResize={(size) =>
              setPanelSizes({
                ...panelSizes,
                left: Math.round(size.asPercentage),
              })
            }
          >
            <Tabs
              defaultValue="normal"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onValueChange={(v) => setLeftTabMode(v as "normal" | "couple")}
            >
              <TabsList className="m-2 mb-0 shrink-0">
                <TabsTrigger value="normal" className="flex-1 text-xs">
                  通常
                </TabsTrigger>
                <TabsTrigger value="couple" className="flex-1 text-xs">
                  マルチキャラ
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="normal"
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <div className="px-3">
                  <div
                    ref={(el) => {
                      sectionRefs.current.lora = el;
                    }}
                  >
                    <Section
                      title="LoRA設定"
                      badge={selectedVariableLora ? "1選択中" : undefined}
                    >
                      <LoraPanel
                        fixedLoras={fixedLoras}
                        onAddFixedLora={addFixedLora}
                        onUpdateFixedLora={updateFixedLora}
                        onRemoveFixedLora={removeFixedLora}
                        variableLoras={variableLoras}
                        selectedVariableLora={selectedVariableLora}
                        onSelectVariableLora={setSelectedVariableLora}
                        onAddVariableLora={addVariableLora}
                        onUpdateVariableLora={updateVariableLora}
                        onRemoveVariableLora={removeVariableLora}
                        onArchiveVariableLora={setVariableLoraArchived}
                      />
                    </Section>
                  </div>

                  <div
                    ref={(el) => {
                      sectionRefs.current.prompt = el;
                    }}
                  >
                    <Section
                      title="プロンプト"
                      badge={
                        selectedCount > 0 ? `${selectedCount}選択` : undefined
                      }
                    >
                      <PromptBuilder
                        variableLora={selectedVariableLora}
                        physicalPresets={physicalPresets}
                        scenePresets={scenePresets}
                        countPresets={countPresets}
                        posePresets={posePresets}
                        otherPresets={otherPresets}
                        selectedPhysicalIds={selectedPhysicalIds}
                        selectedSceneId={selectedSceneId}
                        selectedCountId={selectedCountId}
                        selectedPoseId={selectedPoseId}
                        selectedOtherIds={selectedOtherIds}
                        additionalPrompt={additionalPrompt}
                        additionalPromptMode={additionalPromptMode}
                        negativePrompt={negativePrompt}
                        onTogglePhysical={togglePhysicalPreset}
                        onSelectScene={setSelectedSceneId}
                        onSelectCount={selectCountPreset}
                        onSelectPose={selectPosePreset}
                        onToggleOther={toggleOtherPreset}
                        onSetAdditional={setAdditionalPrompt}
                        onSetAdditionalMode={setAdditionalPromptMode}
                        onSetNegative={setNegativePrompt}
                        fixedTags={fixedTags}
                        onSetFixedTags={setFixedTags}
                        onResetFixedTags={resetFixedTags}
                        onAddPreset={addPreset}
                        onUpdatePreset={updatePreset}
                        onRemovePreset={removePreset}
                        onReorderPresets={reorderPresets}
                        presetCategories={presetCategories}
                        onAddCategory={addCategory}
                        onRenameCategory={renameCategory}
                        onRemoveCategory={removeCategory}
                      />
                    </Section>
                  </div>

                  <div
                    ref={(el) => {
                      sectionRefs.current.sampler = el;
                    }}
                  >
                    <Section title="サンプラー設定" defaultOpen={false}>
                      <SamplerSettings
                        settings={settings}
                        onChange={setSettings}
                        onOpenModelManager={() => setModelManagerOpen(true)}
                      />
                    </Section>
                  </div>

                  <div
                    ref={(el) => {
                      sectionRefs.current.variation = el;
                    }}
                  >
                    <Section
                      title="ランダム構図"
                      defaultOpen={false}
                      badge={variationEnabled ? "ON" : undefined}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={variationEnabled}
                            onCheckedChange={setVariationEnabled}
                            id="variation-toggle"
                          />
                          <Label
                            htmlFor="variation-toggle"
                            className="cursor-pointer text-xs"
                          >
                            ランダム構図
                            {variationEnabled && (
                              <span className="text-primary">が有効</span>
                            )}
                          </Label>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          有効にすると、各枚ごとにランダムな構図タグが追加されます。1タグ1行で入力。
                        </p>
                        <Textarea
                          value={variationTags.join("\n")}
                          onChange={(e) =>
                            setVariationTags(
                              e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                          rows={7}
                          className="font-mono text-xs"
                          placeholder="from above,&#10;from below,&#10;dutch angle,"
                        />
                      </div>
                    </Section>
                  </div>

                  <div
                    ref={(el) => {
                      sectionRefs.current.tagdb = el;
                    }}
                  >
                    <Section title="タグDB設定" defaultOpen={false}>
                      <TagSettings />
                    </Section>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="couple"
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <div
                  ref={(el) => {
                    sectionRefs.current["couple-top"] = el;
                  }}
                >
                  <CouplePanel
                    couple={couple}
                    fixedTags={fixedTags}
                    negativePrompt={negativePrompt}
                    setNegativePrompt={setNegativePrompt}
                    physicalPresets={physicalPresets}
                    posePresets={posePresets}
                    otherPresets={otherPresets}
                    countPresets={countPresets}
                    scenePresets={scenePresets}
                    onAddPreset={addPreset}
                    onUpdatePreset={updatePreset}
                    onRemovePreset={removePreset}
                    onReorderPresets={reorderPresets}
                    presetCategories={presetCategories}
                    onAddCategory={addCategory}
                    onRenameCategory={renameCategory}
                    onRemoveCategory={removeCategory}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            id="center"
            defaultSize={`${panelSizes["center"]}%`}
            minSize="20%"
            className="flex flex-col overflow-hidden"
            onResize={(size) =>
              setPanelSizes({
                ...panelSizes,
                center: Math.round(size.asPercentage),
              })
            }
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
              <div className="mb-2 flex items-center gap-2">
                <BatchQueueDialog
                  batchPresetSets={batchPresetSets}
                  onSaveSet={saveBatchPresetSet}
                  onRemoveSet={removeBatchPresetSet}
                  onReorderSets={reorderBatchPresetSets}
                  onDuplicateSet={duplicateBatchPresetSet}
                  onRunPresets={runBatchPresets}
                  onCaptureCurrentSettings={captureCurrentSettings}
                  variableLoras={nonArchivedVariableLoras}
                  physicalPresets={physicalPresets}
                  scenePresets={scenePresets}
                  countPresets={countPresets}
                  posePresets={posePresets}
                  otherPresets={otherPresets}
                  currentSettings={settings}
                />
                <QuickAddToBatch
                  batchPresetSets={batchPresetSets}
                  onCaptureCurrentSettings={captureCurrentSettings}
                  onSaveSet={saveBatchPresetSet}
                />
                {variationEnabled && (
                  <Badge variant="secondary" className="text-[10px]">
                    ランダム構図 ON
                  </Badge>
                )}
              </div>
              <PreviewPanel
                previewUrl={previewUrl}
                progress={progress}
                isProcessing={isProcessing}
                currentItem={currentItem}
                batchCount={batchCount}
                onBatchCountChange={setBatchCount}
                onAddToQueue={handleAddToQueue}
                onCancel={cancelCurrent}
                onRedoReroll={redoCurrentReroll}
                onRedoSamePrompt={redoCurrentSamePrompt}
                currentJobImages={currentJobImages}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            id="right"
            defaultSize={`${panelSizes["right"]}%`}
            minSize="15%"
            maxSize="50%"
            className="flex flex-col border-l"
            onResize={(size) =>
              setPanelSizes({
                ...panelSizes,
                right: Math.round(size.asPercentage),
              })
            }
          >
            <Tabs
              defaultValue="queue"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <TabsList className="m-2 mb-0 shrink-0">
                <TabsTrigger value="queue" className="flex-1 text-xs">
                  キュー
                  {queue.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      {queue.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="gallery" className="flex-1 text-xs">
                  ギャラリー
                  {gallery.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      {gallery.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="queue"
                className="min-h-0 flex-1 overflow-hidden p-2"
              >
                <QueueManager
                  queue={queue}
                  queueRunning={queueRunning}
                  onRemove={removeFromQueue}
                  onCancelAllPending={cancelAllPending}
                  onClearLog={clearLog}
                  onStart={startQueue}
                  onPause={pauseQueue}
                  onEdit={updateQueueItem}
                  onRunNext={runItemNext}
                  onRequeue={requeueItem}
                />
              </TabsContent>

              <TabsContent
                value="gallery"
                className="min-h-0 flex-1 overflow-hidden p-2"
              >
                <GalleryPanel
                  gallery={gallery}
                  onClear={clearGallery}
                  onRefreshFs={refreshGalleryFromFs}
                />
              </TabsContent>
            </Tabs>

            <GpuMonitor
              snapshots={gpuSnapshots}
              collapsed={gpuCollapsed}
              onToggle={() => setGpuCollapsed((v) => !v)}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <EtaWindow
        queue={queue}
        isProcessing={isProcessing}
        currentJobImages={currentJobImages}
        pos={etaPos}
        onPosChange={setEtaPos}
      />

      <PromptPreviewWindow
        positivePrompt={currentBatchPrompt ?? previewPositive}
        negativePrompt={previewNegative}
        hasRandom={hasRandom}
        isLive={isProcessing && currentBatchPrompt !== null}
        onRefresh={refreshPreview}
        pos={promptPreviewPos}
        onPosChange={setPromptPreviewPos}
      />

      <AlertDialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>生成を中止しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              現在実行中のキューアイテムを中止します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="gap-2 text-xs">
              キャンセル <Kbd>Esc</Kbd>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              autoFocus
              className="gap-2 text-xs"
              onClick={cancelCurrent}
            >
              中止する <Kbd>Enter</Kbd>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
