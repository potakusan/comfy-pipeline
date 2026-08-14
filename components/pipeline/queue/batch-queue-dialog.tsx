"use client";
import { useState } from "react";
import {
  type BatchPreset,
  type BatchPresetSet,
  type BatchRunOverrides,
  type LoraEntry,
  type Preset,
  type GenerationSettings,
} from "@/lib/comfy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft } from "lucide-react";
import ListView from "@/components/pipeline/queue/batch-queue-list-view";
import EditView from "@/components/pipeline/queue/batch-queue-edit-view";
import RunSetupView from "@/components/pipeline/queue/batch-queue-run-setup-view";
import BulkRunSetupView from "@/components/pipeline/queue/batch-queue-bulk-run-setup-view";

interface BatchQueueDialogProps {
  batchPresetSets: BatchPresetSet[];
  onSaveSet: (set: BatchPresetSet) => void;
  onRemoveSet: (id: string) => void;
  onReorderSets: (from: number, to: number) => void;
  onDuplicateSet: (id: string) => void;
  onRunPresets: (presets: BatchPreset[], overrides: BatchRunOverrides) => void;
  onCaptureCurrentSettings: (name?: string) => BatchPreset;
  /** 可変LoRA一覧 (実行前設定で選択させる) */
  variableLoras: LoraEntry[];
  /** 身体的特徴プリセット一覧 (実行前設定で選択させる) */
  physicalPresets: Preset[];
  /** シーンプリセット一覧 (実行前設定で選択させる) */
  scenePresets: Preset[];
  /** 人数プリセット一覧 (保存内容編集用) */
  countPresets: Preset[];
  /** ポーズプリセット一覧 (保存内容編集用) */
  posePresets: Preset[];
  /** その他プリセット一覧 (保存内容編集用) */
  otherPresets: Preset[];
  /** サンプラー設定の初期値 */
  currentSettings: GenerationSettings;
}

export default function BatchQueueDialog({
  batchPresetSets,
  onSaveSet,
  onRemoveSet,
  onReorderSets,
  onDuplicateSet,
  onRunPresets,
  onCaptureCurrentSettings,
  variableLoras,
  physicalPresets,
  scenePresets,
  countPresets,
  posePresets,
  otherPresets,
  currentSettings,
}: BatchQueueDialogProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<
    "list" | "edit" | "run-setup" | "bulk-run-setup"
  >("list");
  const [pendingEditSet, setPendingEditSet] = useState<BatchPresetSet | null>(null);
  const [pendingRunSet, setPendingRunSet] = useState<BatchPresetSet | null>(null);
  const [pendingBulkRunSets, setPendingBulkRunSets] = useState<BatchPresetSet[]>([]);

  function openNewSet() {
    setPendingEditSet({
      id: crypto.randomUUID(),
      name: "新しいセット",
      presets: [],
    });
    setView("edit");
  }

  function openEditSet(set: BatchPresetSet) {
    setPendingEditSet(set);
    setView("edit");
  }

  function backToList() {
    setView("list");
    setPendingEditSet(null);
    setPendingRunSet(null);
    setPendingBulkRunSets([]);
  }

  function openRunSetup(set: BatchPresetSet) {
    setPendingRunSet(set);
    setView("run-setup");
  }

  function openBulkRunSetup(sets: BatchPresetSet[]) {
    setPendingBulkRunSets(sets);
    setView("bulk-run-setup");
  }

  function handleSaveSet(set: BatchPresetSet) {
    onSaveSet(set);
    backToList();
  }

  function handleSaveAndRun(set: BatchPresetSet) {
    onSaveSet(set);
    openRunSetup(set);
  }

  function handleRunConfirm(overrides: BatchRunOverrides) {
    if (!pendingRunSet) return;
    onRunPresets(pendingRunSet.presets, overrides);
    setOpen(false);
    backToList();
  }

  function handleBulkRunConfirm(
    entries: { set: BatchPresetSet; overrides: BatchRunOverrides }[],
  ) {
    entries.forEach(({ set, overrides }) => onRunPresets(set.presets, overrides));
    setOpen(false);
    backToList();
  }

  const dialogTitle =
    view === "list"
      ? "一括キュープリセット"
      : view === "run-setup"
        ? "実行前設定"
        : view === "bulk-run-setup"
          ? "一括実行設定"
          : "セット編集";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) backToList();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Layers className="h-3.5 w-3.5" />
          一括キュー
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] max-w-4xl! flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            {(view === "edit" || view === "run-setup" || view === "bulk-run-setup") && (
              <button
                onClick={backToList}
                className="rounded p-0.5 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        {view === "list" && (
          <ListView
            batchPresetSets={batchPresetSets}
            onEditSet={openEditSet}
            onRemoveSet={onRemoveSet}
            onReorderSets={onReorderSets}
            onDuplicateSet={onDuplicateSet}
            onRunSetup={openRunSetup}
            onBulkRunSetup={openBulkRunSetup}
            onCreateNew={openNewSet}
          />
        )}

        {view === "edit" && pendingEditSet && (
          <EditView
            initialSet={pendingEditSet}
            countPresets={countPresets}
            posePresets={posePresets}
            otherPresets={otherPresets}
            onCaptureCurrentSettings={onCaptureCurrentSettings}
            onSave={handleSaveSet}
            onSaveAndRun={handleSaveAndRun}
            onCancel={backToList}
          />
        )}

        {view === "run-setup" && pendingRunSet && (
          <RunSetupView
            variableLoras={variableLoras}
            physicalPresets={physicalPresets}
            scenePresets={scenePresets}
            initialSettings={currentSettings}
            onConfirm={handleRunConfirm}
            onCancel={backToList}
          />
        )}

        {view === "bulk-run-setup" && pendingBulkRunSets.length > 0 && (
          <BulkRunSetupView
            sets={pendingBulkRunSets}
            variableLoras={variableLoras}
            physicalPresets={physicalPresets}
            scenePresets={scenePresets}
            initialSettings={currentSettings}
            onConfirm={handleBulkRunConfirm}
            onCancel={backToList}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
