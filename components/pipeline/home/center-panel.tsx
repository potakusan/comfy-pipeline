"use client";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ResizablePanel } from "@/components/ui/resizable";
import PreviewPanel from "@/components/pipeline/preview-panel";
import BatchQueueDialog from "@/components/pipeline/queue/batch-queue-dialog";
import QuickAddToBatch from "@/components/pipeline/queue/quick-add-to-batch";
import { type QueueItem } from "@/lib/comfy";
import type { PipelineHook } from "@/hooks/pipeline/use-pipeline";

export interface CenterPanelProps {
  pipeline: PipelineHook;
  currentItem: QueueItem | null;
  onAddToQueue: () => void;
}

export default function CenterPanel({
  pipeline,
  currentItem,
  onAddToQueue,
}: CenterPanelProps) {
  const {
    variableLoras,
    physicalPresets,
    scenePresets,
    countPresets,
    posePresets,
    otherPresets,
    settings,
    batchPresetSets,
    saveBatchPresetSet,
    removeBatchPresetSet,
    reorderBatchPresetSets,
    duplicateBatchPresetSet,
    runBatchPresets,
    captureCurrentSettings,
    variationEnabled,
    previewUrl,
    progress,
    isProcessing,
    batchCount,
    setBatchCount,
    cancelCurrent,
    redoCurrentReroll,
    redoCurrentSamePrompt,
    currentJobImages,
    panelSizes,
    setPanelSizes,
  } = pipeline;

  // アーカイブ済みの可変LoRAはプリセット実行時（一括キュー実行前設定）の選択肢から除外する
  const nonArchivedVariableLoras = useMemo(
    () => variableLoras.filter((l) => !l.isArchived),
    [variableLoras],
  );

  return (
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
          onAddToQueue={onAddToQueue}
          onCancel={cancelCurrent}
          onRedoReroll={redoCurrentReroll}
          onRedoSamePrompt={redoCurrentSamePrompt}
          currentJobImages={currentJobImages}
        />
      </div>
    </ResizablePanel>
  );
}
