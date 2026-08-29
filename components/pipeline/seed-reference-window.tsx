"use client";
import { Sprout } from "lucide-react";
import FloatingWindow from "@/components/gallery/floating-window";
import type { QueueItem } from "@/lib/comfy";
import type { PromptPreviewPos } from "@/hooks/pipeline/use-pipeline";

function archiveThumbUrl(id: string) {
  return `/api/gallery/seed-archive/thumbnail?id=${encodeURIComponent(id)}`;
}

/**
 * シード引き継ぎ(seedPool)で実行中のジョブについて、現在の生成が参照している
 * 元画像(アーカイブ済みサムネ)をプレビュー表示するフローティングウィンドウ。
 * seedPoolを持つジョブが実行中でない間は何も描画しない。
 */
export default function SeedReferenceWindow({
  queue,
  pos,
  onPosChange,
}: {
  queue: QueueItem[];
  pos: PromptPreviewPos;
  onPosChange: (p: PromptPreviewPos) => void;
}) {
  const runningItem = queue.find(
    (i) => i.status === "running" && i.seedPool && i.seedPool.length > 0,
  );

  if (!runningItem || !runningItem.seedPool) return null;

  const entryIndex = Math.min(runningItem.currentBatch, runningItem.seedPool.length - 1);
  const entry = runningItem.seedPool[entryIndex];

  return (
    <FloatingWindow
      title="シード参照元"
      icon={<Sprout className="h-3 w-3 text-muted-foreground" />}
      pos={pos}
      onPosChange={onPosChange}
      defaultWidth={220}
      defaultHeight={280}
      minWidth={160}
      minHeight={200}
      initialPlacement="top-right"
    >
      <div className="flex flex-col gap-1.5 p-2">
        <img
          src={archiveThumbUrl(entry.id)}
          alt={entry.filename}
          className="w-full rounded object-cover"
        />
        <p className="truncate text-[10px] text-muted-foreground" title={runningItem.seedSourceFolder}>
          {runningItem.seedSourceFolder}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          seed: {entry.seed}
          {entry.upscaleSeed !== null && ` / up: ${entry.upscaleSeed}`}
        </p>
      </div>
    </FloatingWindow>
  );
}
