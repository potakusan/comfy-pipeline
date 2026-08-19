"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GraduationCap, HelpCircle, Loader2, Sparkles, Square } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { OptimizerType, MixedPrecision, TrainingJob, TrainingParams } from "@/lib/kohya/types";
import type { DatasetImageEntry, DatasetInfo, TagCategory } from "@/lib/lora-dataset/types";
import { toast } from "sonner";

interface CheckpointItem {
  fileName: string;
  name: string;
}

interface Props {
  dataset: DatasetInfo | null;
  onUpdateDataset: (
    folder: string,
    input: { name: string; repeat: number; triggerWord: string; includeCategories: TagCategory[] },
  ) => Promise<string | null>;
}

const POLL_INTERVAL_MS = 1500;

function defaultParams(dataset: DatasetInfo): Omit<TrainingParams, "checkpointFileName"> {
  return {
    datasetFolder: dataset.folder,
    outputName: dataset.name,
    resolution: 1024,
    networkDim: 32,
    networkAlpha: 16,
    learningRate: 0.0001,
    trainBatchSize: 1,
    maxTrainEpochs: 10,
    saveEveryNEpochs: 2,
    optimizerType: "AdamW8bit",
    mixedPrecision: "bf16",
    seed: 42,
    // 小規模データセットではtext encoderまで学習すると過学習・高強度時の崩壊につながりやすいため、
    // UNetのみ学習をデフォルトにしている（必要ならOFFにできる）。
    networkTrainUnetOnly: true,
  };
}

const FIELD_HELP = {
  checkpoint: "学習のベースにするcheckpoint。WAI-IllustriousなどSDXL系のモデルを選んでください。",
  outputName: "生成されるLoRAファイル名（.safetensors）。トリガーワード欄の初期値としても使われます。",
  resolution: "学習時の画像解像度。SDXL系ベースモデルなら1024が基本です。上げるほどVRAMを消費します。",
  mixedPrecision: "学習時の演算精度。bf16はfp16より数値的に安定しており、基本はbf16で問題ありません。",
  networkDim: "LoRAの表現力（学習容量）。大きいほど細部を覚えられますが、画像が少ないと過学習しやすくなります。目安: 〜20枚なら8〜16、50枚以上なら32。",
  networkAlpha: "LoRAの実効的な強さを決める調整値。Network Dimの半分程度にするのが一般的な目安です。",
  learningRate: "1ステップごとの重み更新の大きさ。高いほど学習は速いですが不安定になりやすく、1e-4(0.0001)が標準的な初期値です。",
  batchSize: "1ステップで同時に学習する画像枚数。増やすほど総ステップ数が減るので、その分epoch数を増やすなどの調整が必要です。",
  maxTrainEpochs: "データセット全体を何周学習するか。多すぎると過学習、少なすぎると特徴を覚えきれません。",
  saveEveryNEpochs: "この間隔でLoRAファイルを保存します。複数epoch分を見比べて一番良いものを選べます。",
  optimizer: "重み更新アルゴリズム。AdamW8bitはVRAM消費を抑えつつ安定して学習できる定番の選択です。",
  networkTrainUnetOnly: "ONだとtext encoderは学習せずUNetのみ更新します。小規模データセットでの過学習・LoRA強度を上げたときの崩壊を防ぎやすくなります。",
  randomizeSeed: "OFFにすると同じシードで学習を再現できます（設定を比較したいときに使用）。通常はONのままで問題ありません。",
  repeat: "1epochで各画像を学習に使う回数（データセットのrepeat設定）。画像が少ないのに高くしすぎると同じ画像を何度も見て過学習しやすくなります。",
} as const;

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" tabIndex={-1} className="text-muted-foreground hover:text-foreground">
            <HelpCircle className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{help}</TooltipContent>
      </Tooltip>
    </span>
  );
}

interface Recommendation {
  networkDim: number;
  networkAlpha: number;
  repeat: number;
  maxTrainEpochs: number;
  networkTrainUnetOnly: boolean;
  targetSteps: number;
  avgTagCount: number;
}

/** データセットの枚数・平均タグ数から、過学習/未学習になりにくい設定を大まかに提案する。 */
function recommendSettings(imageCount: number, avgTagCount: number): Recommendation {
  let networkDim: number;
  let repeat: number;
  let targetSteps: number;
  let networkTrainUnetOnly: boolean;

  if (imageCount < 20) {
    networkDim = 8;
    repeat = 3;
    targetSteps = 1000;
    networkTrainUnetOnly = true;
  } else if (imageCount < 50) {
    networkDim = 16;
    repeat = 2;
    targetSteps = 1500;
    networkTrainUnetOnly = true;
  } else {
    networkDim = 32;
    repeat = 1;
    targetSteps = 2000;
    networkTrainUnetOnly = false;
  }

  const maxTrainEpochs = Math.max(4, Math.round(targetSteps / (imageCount * repeat)));
  return {
    networkDim,
    networkAlpha: Math.max(1, Math.round(networkDim / 2)),
    repeat,
    maxTrainEpochs,
    networkTrainUnetOnly,
    targetSteps,
    avgTagCount,
  };
}

export default function KohyaTrainModal({ dataset, onUpdateDataset }: Props) {
  const [open, setOpen] = useState(false);
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [checkpointFileName, setCheckpointFileName] = useState("");
  const [images, setImages] = useState<DatasetImageEntry[]>([]);
  const [params, setParams] = useState<Omit<TrainingParams, "checkpointFileName"> | null>(null);
  const [randomizeSeed, setRandomizeSeed] = useState(true);
  const [repeatInput, setRepeatInput] = useState(1);
  const [savingRepeat, setSavingRepeat] = useState(false);
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  // openが変化した瞬間だけ初期化したい。datasetを依存に含めると、モーダル内でrepeatを
  // 保存した際のフォルダrename(=datasetの参照変更)で他の入力中パラメータまで
  // 初期値にリセットされてしまうため意図的に外している。
  useEffect(() => {
    if (!open || !dataset) return;
    setParams(defaultParams(dataset));
    setRepeatInput(dataset.repeat);
    setJob(null);
    apiFetch<{ items: CheckpointItem[] }>("/api/models/checkpoints")
      .then(({ items }) => {
        setCheckpoints(items);
        setCheckpointFileName((prev) => prev || items[0]?.fileName || "");
      })
      .catch(() => toast.error("チェックポイント一覧の取得に失敗しました"));
    apiFetch<{ images: DatasetImageEntry[] }>(`/api/lora-dataset/images?folder=${encodeURIComponent(dataset.folder)}`)
      .then(({ images }) => setImages(images))
      .catch(() => setImages([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log.length]);

  const recommendation = useMemo(() => {
    if (!dataset || dataset.imageCount === 0) return null;
    const tagCounts = images.map((img) => img.caption.split(",").filter((t) => t.trim()).length);
    const avgTagCount = tagCounts.length > 0 ? tagCounts.reduce((a, b) => a + b, 0) / tagCounts.length : 0;
    return recommendSettings(dataset.imageCount, avgTagCount);
  }, [dataset, images]);

  const applyRecommendation = () => {
    if (!recommendation) return;
    setParams((prev) =>
      prev
        ? {
            ...prev,
            networkDim: recommendation.networkDim,
            networkAlpha: recommendation.networkAlpha,
            maxTrainEpochs: recommendation.maxTrainEpochs,
            networkTrainUnetOnly: recommendation.networkTrainUnetOnly,
          }
        : prev,
    );
  };

  const handleSaveRepeat = async () => {
    if (!dataset || repeatInput === dataset.repeat) return;
    setSavingRepeat(true);
    try {
      const err = await onUpdateDataset(dataset.folder, {
        name: dataset.name,
        repeat: repeatInput,
        triggerWord: dataset.triggerWord,
        includeCategories: dataset.includeCategories,
      });
      if (err) toast.error(err);
      else toast.success(`repeatを${repeatInput}に変更しました`);
    } finally {
      setSavingRepeat(false);
    }
  };

  const pollJob = (jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch<TrainingJob>(`/api/lora-dataset/kohya/train/${jobId}`);
        setJob(data);
        if (data.status !== "pending" && data.status !== "running") stopPolling();
      } catch {
        // 一時的な取得失敗は無視して次のポーリングを待つ
      }
    }, POLL_INTERVAL_MS);
  };

  const handleStart = async () => {
    if (!dataset || !params || !checkpointFileName) return;
    setStarting(true);
    try {
      const fullParams: TrainingParams = {
        ...params,
        checkpointFileName,
        seed: randomizeSeed ? Math.floor(Math.random() * 2 ** 31) : params.seed,
      };
      const { jobId } = await apiFetch<{ jobId: string }>("/api/lora-dataset/kohya/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: fullParams }),
      });
      setJob({
        id: jobId,
        status: "pending",
        log: [],
        startedAt: Date.now(),
        datasetFolder: fullParams.datasetFolder,
        outputName: fullParams.outputName,
      });
      pollJob(jobId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "学習の開始に失敗しました");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!job) return;
    try {
      await apiFetch(`/api/lora-dataset/kohya/train/${job.id}`, { method: "DELETE" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "停止に失敗しました");
    }
  };

  const running = job?.status === "pending" || job?.status === "running";

  const set = <K extends keyof Omit<TrainingParams, "checkpointFileName">>(
    key: K,
    value: Omit<TrainingParams, "checkpointFileName">[K],
  ) => setParams((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
        disabled={!dataset}
      >
        <GraduationCap className="h-3.5 w-3.5" />
        LoRA学習
      </Button>

      <Dialog open={open} onOpenChange={(v) => !running && setOpen(v)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>LoRA学習{dataset && ` — ${dataset.name}`}</DialogTitle>
          </DialogHeader>

          {dataset && params && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                データセット: {dataset.name}（{dataset.imageCount}枚）
              </p>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="データセットのRepeat" help={FIELD_HELP.repeat} />
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={repeatInput}
                    onChange={(e) => setRepeatInput(Number(e.target.value) || 1)}
                    disabled={running || savingRepeat}
                    className="text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleSaveRepeat}
                  disabled={running || savingRepeat || repeatInput === dataset.repeat}
                >
                  {savingRepeat && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  保存
                </Button>
              </div>

              {recommendation && (
                <Alert>
                  <Sparkles />
                  <AlertTitle>このデータセットへの推奨設定</AlertTitle>
                  <AlertDescription>
                    <p>
                      画像{dataset.imageCount}枚・平均タグ数{recommendation.avgTagCount.toFixed(1)}個から算出（目安の総ステップ数
                      {recommendation.targetSteps}）:
                    </p>
                    <ul className="list-disc pl-4">
                      <li>Network Dim: {recommendation.networkDim} / Alpha: {recommendation.networkAlpha}</li>
                      <li>Epoch数: {recommendation.maxTrainEpochs}</li>
                      <li>UNetのみ学習: {recommendation.networkTrainUnetOnly ? "ON推奨" : "OFFでも可"}</li>
                      <li>
                        データセットのrepeat: {recommendation.repeat}
                        {recommendation.repeat !== dataset.repeat && `（現在${dataset.repeat}）`}
                      </li>
                    </ul>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={applyRecommendation}>
                        Dim/Alpha/Epoch数/UNetのみ学習に適用
                      </Button>
                      {recommendation.repeat !== dataset.repeat && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => setRepeatInput(recommendation.repeat)}
                        >
                          Repeat欄に反映（上の「保存」で確定）
                        </Button>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label className="text-xs">
                  <FieldLabel label="ベースモデル" help={FIELD_HELP.checkpoint} />
                </Label>
                <NativeSelect
                  size="sm"
                  className="w-full"
                  value={checkpointFileName}
                  onChange={(e) => setCheckpointFileName(e.target.value)}
                  disabled={running}
                >
                  {checkpoints.length === 0 && <NativeSelectOption value="">読み込み中...</NativeSelectOption>}
                  {checkpoints.map((c) => (
                    <NativeSelectOption key={c.fileName} value={c.fileName}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  <FieldLabel label="出力名" help={FIELD_HELP.outputName} />
                </Label>
                <Input
                  value={params.outputName}
                  onChange={(e) => set("outputName", e.target.value)}
                  disabled={running}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="解像度" help={FIELD_HELP.resolution} />
                  </Label>
                  <NativeSelect
                    size="sm"
                    className="w-full"
                    value={params.resolution}
                    onChange={(e) => set("resolution", Number(e.target.value))}
                    disabled={running}
                  >
                    {[768, 1024, 1216, 1344].map((r) => (
                      <NativeSelectOption key={r} value={r}>
                        {r}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="Mixed precision" help={FIELD_HELP.mixedPrecision} />
                  </Label>
                  <NativeSelect
                    size="sm"
                    className="w-full"
                    value={params.mixedPrecision}
                    onChange={(e) => set("mixedPrecision", e.target.value as MixedPrecision)}
                    disabled={running}
                  >
                    <NativeSelectOption value="bf16">bf16</NativeSelectOption>
                    <NativeSelectOption value="fp16">fp16</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="Network Dim" help={FIELD_HELP.networkDim} />
                  </Label>
                  <Input
                    type="number"
                    value={params.networkDim}
                    onChange={(e) => set("networkDim", Number(e.target.value) || 1)}
                    disabled={running}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="Network Alpha" help={FIELD_HELP.networkAlpha} />
                  </Label>
                  <Input
                    type="number"
                    value={params.networkAlpha}
                    onChange={(e) => set("networkAlpha", Number(e.target.value) || 1)}
                    disabled={running}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="Learning rate" help={FIELD_HELP.learningRate} />
                  </Label>
                  <Input
                    type="number"
                    step="0.00001"
                    value={params.learningRate}
                    onChange={(e) => set("learningRate", Number(e.target.value) || 0)}
                    disabled={running}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="Batch size" help={FIELD_HELP.batchSize} />
                  </Label>
                  <Input
                    type="number"
                    value={params.trainBatchSize}
                    onChange={(e) => set("trainBatchSize", Number(e.target.value) || 1)}
                    disabled={running}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="Epoch数" help={FIELD_HELP.maxTrainEpochs} />
                  </Label>
                  <Input
                    type="number"
                    value={params.maxTrainEpochs}
                    onChange={(e) => set("maxTrainEpochs", Number(e.target.value) || 1)}
                    disabled={running}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="何epochごとに保存" help={FIELD_HELP.saveEveryNEpochs} />
                  </Label>
                  <Input
                    type="number"
                    value={params.saveEveryNEpochs}
                    onChange={(e) => set("saveEveryNEpochs", Number(e.target.value) || 1)}
                    disabled={running}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <FieldLabel label="Optimizer" help={FIELD_HELP.optimizer} />
                  </Label>
                  <NativeSelect
                    size="sm"
                    className="w-full"
                    value={params.optimizerType}
                    onChange={(e) => set("optimizerType", e.target.value as OptimizerType)}
                    disabled={running}
                  >
                    {(["AdamW8bit", "AdamW", "Lion8bit", "Prodigy"] as const).map((o) => (
                      <NativeSelectOption key={o} value={o}>
                        {o}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="col-span-2 flex items-center justify-between">
                  <Label className="text-xs">
                    <FieldLabel label="UNetのみ学習" help={FIELD_HELP.networkTrainUnetOnly} />
                  </Label>
                  <Switch
                    checked={params.networkTrainUnetOnly}
                    onCheckedChange={(v) => set("networkTrainUnetOnly", v)}
                    disabled={running}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    <FieldLabel label="シードランダム" help={FIELD_HELP.randomizeSeed} />
                  </Label>
                  <Switch checked={randomizeSeed} onCheckedChange={setRandomizeSeed} disabled={running} />
                </div>
                {!randomizeSeed && (
                  <div className="space-y-1">
                    <Label className="text-xs">シード</Label>
                    <Input
                      type="number"
                      value={params.seed}
                      onChange={(e) => set("seed", Number(e.target.value) || 0)}
                      disabled={running}
                      className="text-xs"
                    />
                  </div>
                )}
              </div>

              {job && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      状態: {job.status}
                      {job.error && ` — ${job.error}`}
                    </Label>
                    {(job.status === "pending" || job.status === "running") && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <pre
                    ref={logRef}
                    className="h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 text-[10px] whitespace-pre-wrap"
                  >
                    {job.log.join("\n") || "ログはまだありません"}
                  </pre>
                  {job.status === "completed" && (
                    <p className="text-xs text-muted-foreground">
                      「{job.outputName}.safetensors」としてLoRAフォルダに保存されました。モデルマネージャーから使用できます
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {running ? (
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleStop}>
                <Square className="h-3.5 w-3.5" />
                停止
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  閉じる
                </Button>
                <Button onClick={handleStart} disabled={starting || !checkpointFileName}>
                  {starting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  学習開始
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
