"use client";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import FloatingWindow from "@/components/gallery/floating-window";
import type { QueueItem, GalleryImage } from "@/lib/comfy";
import type { PromptPreviewPos } from "@/hooks/pipeline/use-pipeline";

function formatEta(ms: number): string {
  if (ms <= 0) return "0秒";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}秒`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return s > 0 ? `${m}分${s}秒` : `${m}分`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}時間${rm}分` : `${h}時間`;
}

export default function EtaWindow({
  queue,
  isProcessing,
  currentJobImages,
  pos,
  onPosChange,
}: {
  queue: QueueItem[];
  isProcessing: boolean;
  currentJobImages: GalleryImage[];
  pos: PromptPreviewPos;
  onPosChange: (p: PromptPreviewPos) => void;
}) {
  // Timing tracking
  const durationsRef = useRef<number[]>([]);
  const [avgMs, setAvgMs] = useState<number | null>(null);
  const lastEventRef = useRef<number>(0);
  const prevImgLenRef = useRef(0);
  const prevProcessingRef = useRef(false);

  useEffect(() => {
    if (isProcessing && !prevProcessingRef.current) {
      lastEventRef.current = Date.now();
      prevImgLenRef.current = 0;
    }
    prevProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    const prevLen = prevImgLenRef.current;
    const newLen = currentJobImages.length;

    if (newLen === 0 && prevLen > 0) {
      lastEventRef.current = Date.now();
      prevImgLenRef.current = 0;
      return;
    }

    if (newLen > prevLen && lastEventRef.current > 0) {
      const delta = newLen - prevLen;
      const elapsed = Date.now() - lastEventRef.current;
      const perImg = elapsed / delta;
      if (perImg >= 500) {
        const updated = [...durationsRef.current, perImg].slice(-10);
        durationsRef.current = updated;
        setAvgMs(updated.reduce((a, b) => a + b, 0) / updated.length);
      }
      lastEventRef.current = Date.now();
    }

    prevImgLenRef.current = newLen;
  }, [currentJobImages.length]);

  const runningItem = queue.find((i) => i.status === "running");
  const remainingCurrent = runningItem ? runningItem.batchCount - runningItem.currentBatch : 0;
  const pendingTotal = queue
    .filter((i) => i.status === "pending")
    .reduce((s, i) => s + i.batchCount, 0);
  const totalRemaining = remainingCurrent + pendingTotal;

  // Live tick for countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isProcessing || avgMs === null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isProcessing, avgMs]);

  const etaMs =
    avgMs !== null && totalRemaining > 0
      ? Math.max(
          0,
          avgMs * totalRemaining -
            (lastEventRef.current > 0 ? Date.now() - lastEventRef.current : 0),
        )
      : null;

  return (
    <FloatingWindow
      title="ETA"
      icon={<Clock className="h-3 w-3 text-muted-foreground" />}
      badges={
        isProcessing && (
          <Badge variant="default" className="text-[9px]">生成中</Badge>
        )
      }
      pos={pos}
      onPosChange={onPosChange}
      defaultWidth={208}
      defaultHeight={140}
      minWidth={160}
      minHeight={100}
      initialPlacement="top-right"
    >
      <div className="space-y-1.5 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">残り画像</span>
          <span className="font-mono text-xs font-semibold">{totalRemaining}枚</span>
        </div>

        {avgMs !== null && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">平均/枚</span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatEta(avgMs)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">完了予測</span>
          <span
            className={`font-mono text-xs font-semibold ${
              isProcessing && etaMs !== null ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {!isProcessing
              ? "待機中"
              : etaMs === null
                ? "計測中..."
                : `約 ${formatEta(etaMs)}`}
          </span>
        </div>
      </div>
    </FloatingWindow>
  );
}
