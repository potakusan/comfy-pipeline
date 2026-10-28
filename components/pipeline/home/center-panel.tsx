"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ResizablePanel } from "@/components/ui/resizable";
import PreviewPanel from "@/components/pipeline/preview-panel";
import BatchQueueDialog from "@/components/pipeline/queue/batch-queue-dialog";
import SavedPresetsDialog from "@/components/pipeline/queue/saved-presets-dialog";
import QuickAddToBatch from "@/components/pipeline/queue/quick-add-to-batch";
import {
  type QueueItem,
  type SeedSource,
  type MoreGenerationRequest,
  buildMoreGenerationRun,
} from "@/lib/comfy";
import { MORE_GENERATION_STORAGE_KEY } from "@/lib/gallery-more-generation";
import { apiFetch } from "@/lib/api-client";
import { uploadImageToComfyInput } from "@/lib/comfy-upload";
import type { PipelineHook } from "@/hooks/pipeline/use-pipeline";

export interface CenterPanelProps {
  pipeline: PipelineHook;
  currentItem: QueueItem | null;
  onAddToQueue: () => void;
  /** 未入力の必須 %%変数%% 等でキュー追加を止める理由(あればボタンを無効化) */
  addBlockedReason?: string;
}

/** フォルダ単位のシード引き継ぎ元(保存済みレシピ・seed一覧)を取得する */
async function fetchSeedSource(folder: string): Promise<SeedSource> {
  const res = await apiFetch<Omit<SeedSource, "folder">>(
    `/api/gallery/seed-pool?folder=${encodeURIComponent(folder)}`,
  );
  return { ...res, folder };
}

export default function CenterPanel({
  pipeline,
  currentItem,
  onAddToQueue,
  addBlockedReason,
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
    variableDefs,
    setVariableDefs,
    variableInputValues,
    fixedTags,
    setImageRef,
  } = pipeline;

  // アーカイブ済みの可変LoRAはプリセット実行時（一括キュー実行前設定）の選択肢から除外する
  const nonArchivedVariableLoras = useMemo(
    () => variableLoras.filter((l) => !l.isArchived),
    [variableLoras],
  );

  // ギャラリーの「このフォルダの良品seedで一括キューを実行」から
  // ?seedSourceFolder=<folder> 付きで遷移してきた場合、そのフォルダの
  // 販売用選択画像のseedを取得し、一括キューダイアログへ引き継ぐ
  const router = useRouter();
  const searchParams = useSearchParams();
  const seedSourceFolderParam = searchParams.get("seedSourceFolder");
  const [seedSource, setSeedSource] = useState<SeedSource | null>(null);

  useEffect(() => {
    if (!seedSourceFolderParam) return;
    let cancelled = false;
    fetchSeedSource(seedSourceFolderParam)
      .then((src) => {
        if (!cancelled) setSeedSource(src);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seedSourceFolderParam]);

  // ギャラリーのポーズ別集計から ?runMore=1 付きで遷移してきたら、引き継いだレシピを
  // ランダム部分を引き直してそのままキューへ追加する。設定の読み込み完了を待つため少し遅らせて実行する
  const runMoreParam = searchParams.get("runMore");
  const runBatchRef = useRef(runBatchPresets);
  useEffect(() => {
    runBatchRef.current = runBatchPresets;
  });
  useEffect(() => {
    if (!runMoreParam) return;
    const timer = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(MORE_GENERATION_STORAGE_KEY);
        sessionStorage.removeItem(MORE_GENERATION_STORAGE_KEY);
        const req = raw ? (JSON.parse(raw) as MoreGenerationRequest) : null;
        const run = req ? buildMoreGenerationRun(req.group, req.count) : null;
        if (run) void runBatchRef.current(run.presets, run.overrides);
        else toast.error("追加生成の情報が見つかりませんでした");
      } catch {
        toast.error("追加生成の情報を読み込めませんでした");
      }
      router.replace("/");
    }, 400);
    return () => clearTimeout(timer);
  }, [runMoreParam, router]);

  // 作成画面の「保存済みプリセット」モーダルから選ばれたフォルダを一括キューへ引き継ぐ
  const handleSelectSavedPreset = (folder: string) => {
    fetchSeedSource(folder)
      .then(setSeedSource)
      .catch(() => toast.error("保存済みプリセットを読み込めませんでした"));
  };

  const handleConsumeSeedSource = () => {
    setSeedSource(null);
    router.replace("/");
  };

  // ギャラリーから ?img2imgRef=<出力相対パス> 付きで遷移してきたら、その画像を
  // ComfyUI の input へアップロードして下絵(imageRef)にセットする。
  const img2imgRefParam = searchParams.get("img2imgRef");
  useEffect(() => {
    if (!img2imgRefParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/comfy/output/image?path=${encodeURIComponent(img2imgRefParam)}`,
        );
        if (!res.ok) return;
        const blob = await res.blob();
        const name = await uploadImageToComfyInput(blob, `ref_${Date.now()}.png`);
        if (!cancelled) {
          setImageRef({
            name,
            denoise: 0.8,
            sourceLabel: img2imgRefParam.split("/").pop() ?? img2imgRefParam,
          });
        }
      } catch {
        // 取得/アップロード失敗時は何もしない(ユーザーが手動で設定できる)
      } finally {
        if (!cancelled) router.replace("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [img2imgRefParam, setImageRef, router]);

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
            seedSource={seedSource}
            onConsumeSeedSource={handleConsumeSeedSource}
            variableDefs={variableDefs}
            onVariableDefsChange={setVariableDefs}
            fixedTags={fixedTags}
            variableInputValues={variableInputValues}
          />
          <SavedPresetsDialog onSelect={handleSelectSavedPreset} />
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
          addBlockedReason={addBlockedReason}
          onCancel={cancelCurrent}
          onRedoReroll={redoCurrentReroll}
          onRedoSamePrompt={redoCurrentSamePrompt}
          currentJobImages={currentJobImages}
        />
      </div>
    </ResizablePanel>
  );
}
