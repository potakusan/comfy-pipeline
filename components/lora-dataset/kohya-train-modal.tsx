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
import { Loader2, GraduationCap, Square } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { TrainingJob, TrainingParams } from "@/lib/kohya/types";
import type { DatasetImageEntry, DatasetInfo, TagCategory } from "@/lib/lora-dataset/types";
import { toast } from "sonner";
import { defaultParams, recommendSettings } from "@/components/lora-dataset/kohya-train-helpers";
import KohyaTrainRecommendation from "@/components/lora-dataset/kohya-train-recommendation";
import KohyaTrainFields, {
  FieldLabel,
  FIELD_HELP,
  type CheckpointItem,
} from "@/components/lora-dataset/kohya-train-fields";
import KohyaTrainJobLog from "@/components/lora-dataset/kohya-train-job-log";

interface Props {
  dataset: DatasetInfo | null;
  onUpdateDataset: (
    folder: string,
    input: { name: string; repeat: number; triggerWord: string; includeCategories: TagCategory[] },
  ) => Promise<string | null>;
}

const POLL_INTERVAL_MS = 1500;

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
                <KohyaTrainRecommendation
                  dataset={dataset}
                  recommendation={recommendation}
                  onApply={applyRecommendation}
                  onSetRepeat={setRepeatInput}
                />
              )}

              <KohyaTrainFields
                params={params}
                set={set}
                checkpoints={checkpoints}
                checkpointFileName={checkpointFileName}
                onCheckpointFileNameChange={setCheckpointFileName}
                randomizeSeed={randomizeSeed}
                onRandomizeSeedChange={setRandomizeSeed}
                running={running}
              />

              {job && <KohyaTrainJobLog job={job} />}
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
