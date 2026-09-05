"use client";
import { useState } from "react";
import {
  type BatchPreset,
  type BatchPresetSet,
  type BatchRunOverrides,
  type LoraEntry,
  type Preset,
  type GenerationSettings,
  type ReleasedSeed,
  type VariableDefs,
  type VariableBindings,
  type PromptReplacement,
  extractVariableNames,
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
import VariableInputView from "@/components/pipeline/queue/batch-queue-variable-input-view";
import { findSetByFilenamePresetName } from "@/lib/gallery-preset-name-match";

/** セット＋オーバーライド＋固定タグが参照する `%%name%%` 変数が1つでもあるか。
 * 一括生成の実プロンプト組み立て(runBatchPresets)と同じテキストを走査する。 */
function setUsesVariables(
  set: BatchPresetSet,
  overrides: BatchRunOverrides,
  fixedTags: string,
  countPresets: Preset[],
  posePresets: Preset[],
  otherPresets: Preset[],
): boolean {
  const texts: string[] = [fixedTags];
  for (const bp of set.presets) {
    texts.push(bp.additionalPrompt, bp.fixedTags);
    if (bp.countPresetId)
      texts.push(countPresets.find((p) => p.id === bp.countPresetId)?.prompt ?? "");
    if (bp.posePresetId)
      texts.push(posePresets.find((p) => p.id === bp.posePresetId)?.prompt ?? "");
    for (const oid of bp.otherPresetIds)
      texts.push(otherPresets.find((p) => p.id === oid)?.prompt ?? "");
  }
  for (const p of overrides.physicalPresets) texts.push(p.prompt);
  if (overrides.scenePreset) texts.push(overrides.scenePreset.prompt);
  return extractVariableNames(texts.join("\n")).length > 0;
}

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
  /** ギャラリーから「シード引き継ぎ元フォルダ」付きで遷移してきた場合に設定される。
   * 設定されるとダイアログを自動的に開く。 */
  seedSource?: {
    folder: string;
    seeds: ReleasedSeed[];
    batchPresetId?: string;
    bindings?: VariableBindings;
  } | null;
  /** seedSourceを読み取り終えたことを親に伝える(URLクエリパラメータのクリア用) */
  onConsumeSeedSource?: () => void;
  /** `%%name%%` 変数の定義(グローバル)。変数入力ステップで参照・編集する。 */
  variableDefs: VariableDefs;
  onVariableDefsChange: (defs: VariableDefs) => void;
  /** 現在の固定タグ(一括生成時も使われるため、変数検出・入力ステップの走査対象に含める) */
  fixedTags: string;
  /** 通常モードのフローティングウィンドウで入力済みの変数値。変数入力ステップの既定値に引き継ぐ。 */
  variableInputValues: VariableBindings;
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
  seedSource,
  onConsumeSeedSource,
  variableDefs,
  onVariableDefsChange,
  fixedTags,
  variableInputValues,
}: BatchQueueDialogProps) {
  const [open, setOpen] = useState(false);
  // seedSourceが設定されたら(ギャラリーからの遷移時)自動的に開く。effect無しで
  // 導出できるようopenとの論理和で表現する(onOpenChangeでの閉じる操作は
  // onConsumeSeedSourceでseedSource自体をクリアすることで反映される)。
  const isOpen = open || !!seedSource;
  const [view, setView] = useState<
    "list" | "edit" | "run-setup" | "variable-input" | "bulk-run-setup"
  >("list");
  const [pendingEditSet, setPendingEditSet] = useState<BatchPresetSet | null>(null);
  const [pendingRunSet, setPendingRunSet] = useState<BatchPresetSet | null>(null);
  const [pendingRunOverrides, setPendingRunOverrides] =
    useState<BatchRunOverrides | null>(null);
  const [pendingBulkRunSets, setPendingBulkRunSets] = useState<BatchPresetSet[]>([]);

  // seedSourceにbatchPresetIdが含まれる場合、それを持つプリセットを含むセットを
  // 自動的に特定してrun-setup画面まで進める(一覧からの手動選択を省略する)。
  // batchPresetId未記録(#58より前に生成された画像)の場合は、保存済み
  // ファイル名から復元したプリセット名で現在のプリセットと突き合わせる
  // フォールバックを試す(findSetByFilenamePresetName参照。名前ベースなので
  // ID一致より弱いベストエフォート)。
  // レンダー中にstateを調整する(useEffect不使用)ことで、propが変化した
  // タイミングだけ反応させる — https://react.dev/learn/you-might-not-need-an-effect
  const [autoSelectedFolder, setAutoSelectedFolder] = useState<string | null>(null);
  if (seedSource && seedSource.folder !== autoSelectedFolder) {
    setAutoSelectedFolder(seedSource.folder);
    const matchedSet =
      (seedSource.batchPresetId
        ? batchPresetSets.find((set) =>
            set.presets.some((p) => p.id === seedSource.batchPresetId),
          )
        : undefined) ?? findSetByFilenamePresetName(seedSource.seeds, batchPresetSets);
    if (matchedSet) {
      setPendingRunSet(matchedSet);
      setView("run-setup");
    }
  } else if (!seedSource && autoSelectedFolder !== null) {
    setAutoSelectedFolder(null);
  }

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
    setPendingRunOverrides(null);
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
    // セットが `%%name%%` 変数を使うなら、実行前に変数入力ステップを挟む。
    if (
      setUsesVariables(
        pendingRunSet,
        overrides,
        fixedTags,
        countPresets,
        posePresets,
        otherPresets,
      )
    ) {
      setPendingRunOverrides(overrides);
      setView("variable-input");
      return;
    }
    // 変数が検出されなくても、通常モードで入力済みの値は既定として渡しておく。
    onRunPresets(pendingRunSet.presets, {
      ...overrides,
      variableValues: variableInputValues,
    });
    setOpen(false);
    backToList();
  }

  function handleVariableInputConfirm(
    variableValues: VariableBindings,
    promptReplacements: PromptReplacement[],
  ) {
    if (!pendingRunSet || !pendingRunOverrides) return;
    onRunPresets(pendingRunSet.presets, {
      ...pendingRunOverrides,
      variableValues,
      promptReplacements,
    });
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
        : view === "variable-input"
          ? "変数入力"
          : view === "bulk-run-setup"
            ? "一括実行設定"
            : "セット編集";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          backToList();
          if (seedSource) onConsumeSeedSource?.();
        }
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
            {(view === "edit" ||
              view === "run-setup" ||
              view === "variable-input" ||
              view === "bulk-run-setup") && (
              <button
                onClick={
                  view === "variable-input"
                    ? () => setView("run-setup")
                    : backToList
                }
                className="rounded p-0.5 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {dialogTitle}
            {seedSource && (
              <span className="text-[10px] font-normal text-muted-foreground">
                (シード引き継ぎ元: {seedSource.folder})
              </span>
            )}
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
            presets={pendingRunSet.presets}
            initialSettings={currentSettings}
            seedSource={seedSource}
            onConfirm={handleRunConfirm}
            onCancel={backToList}
          />
        )}

        {view === "variable-input" && pendingRunSet && pendingRunOverrides && (
          <VariableInputView
            set={pendingRunSet}
            overrides={pendingRunOverrides}
            fixedTags={fixedTags}
            countPresets={countPresets}
            posePresets={posePresets}
            otherPresets={otherPresets}
            variableDefs={variableDefs}
            onDefsChange={onVariableDefsChange}
            baseValues={variableInputValues}
            seedBindings={seedSource?.bindings}
            onConfirm={handleVariableInputConfirm}
            onBack={() => setView("run-setup")}
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
