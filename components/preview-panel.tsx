"use client";
import { useState, useEffect, useRef } from "react";
import { type QueueItem, type GalleryImage } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StopCircle, Play, ImageIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PreviewPanelProps {
  previewUrl: string | null;
  progress: { value: number; max: number };
  isProcessing: boolean;
  currentItem: QueueItem | null;
  batchCount: number;
  onBatchCountChange: (n: number) => void;
  onAddToQueue: () => void;
  onCancel: () => void;
  currentJobImages: GalleryImage[];
}

function outputImageUrl(path: string) {
  return `/api/comfy/output/image?path=${encodeURIComponent(path)}`;
}

function thumbUrl(path: string) {
  return `/api/comfy/output/thumbnail?path=${encodeURIComponent(path)}`;
}

export default function PreviewPanel({
  previewUrl,
  progress,
  isProcessing,
  currentItem,
  batchCount,
  onBatchCountChange,
  onAddToQueue,
  onCancel,
  currentJobImages,
}: PreviewPanelProps) {
  const progressPct =
    progress.max > 0 ? Math.round((progress.value / progress.max) * 100) : 0;

  // focusedPath: null = auto mode (live preview while processing, last completed when done)
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const prevLenRef = useRef(0);

  // Auto-follow latest completed image unless user has manually focused a different one
  useEffect(() => {
    const newLen = currentJobImages.length;
    if (newLen > prevLenRef.current) {
      const prevLastPath =
        prevLenRef.current > 0
          ? currentJobImages[prevLenRef.current - 1]?.path
          : null;
      // Auto-advance if: no manual selection, or was already on the previous last
      if (focusedPath === null || focusedPath === prevLastPath) {
        setFocusedPath(currentJobImages[newLen - 1].path);
      }
    }
    prevLenRef.current = newLen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobImages]);

  // Clear strip when a new job starts (images reset to empty)
  useEffect(() => {
    if (currentJobImages.length === 0) {
      setFocusedPath(null);
      prevLenRef.current = 0;
    }
  }, [currentJobImages.length]);

  // During processing: always show live preview. After processing: show focused or last completed.
  const mainUrl = isProcessing
    ? previewUrl
    : focusedPath
      ? outputImageUrl(focusedPath)
      : currentJobImages.length > 0
        ? outputImageUrl(currentJobImages[currentJobImages.length - 1].path)
        : null;

  const showPlaceholder = !mainUrl && currentJobImages.length === 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative flex-1 overflow-hidden rounded-xl border bg-muted/30">
        {mainUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mainUrl}
            alt="プレビュー"
            className="h-[60vh] w-full object-contain"
          />
        ) : showPlaceholder ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="h-16 w-16 opacity-20" />
            <p className="text-sm">プレビューがここに表示されます</p>
          </div>
        ) : null}

        {isProcessing && (
          <div className="absolute left-2 top-2">
            <Badge className="gap-1 text-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              生成中
            </Badge>
          </div>
        )}
      </div>

      {currentJobImages.length > 0 && (
        <TooltipProvider delayDuration={300}>
          <div className="flex gap-1.5 overflow-x-auto rounded-lg border bg-muted/20 p-1.5 shrink-0">
            {currentJobImages.map((img, i) => (
              <Tooltip key={img.path}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      setFocusedPath(img.path === focusedPath ? null : img.path)
                    }
                    className={`relative shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                      img.path === focusedPath
                        ? "border-primary"
                        : "border-transparent hover:border-muted-foreground/50"
                    }`}
                    style={{ width: 72, height: 72 }}
                  >
                    <img
                      src={thumbUrl(img.path)}
                      alt={`完成 ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/40 text-center text-[9px] text-white leading-tight py-0.5">
                      {i + 1}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="p-1">
                  <img
                    src={outputImageUrl(img.path)}
                    alt={`プレビュー ${i + 1}`}
                    className="max-h-256 max-w-256 rounded object-contain"
                  />
                  {img.appliedAdditional && (
                    <p className="mt-1 max-w-64 text-[10px] text-muted-foreground whitespace-pre-wrap">
                      {img.appliedAdditional}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}

      {isProcessing && (
        <div className="space-y-1 shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {currentItem && (
              <span>
                {currentItem.label} — {currentItem.currentBatch}/
                {currentItem.batchCount}枚
              </span>
            )}
            {progress.max > 0 && (
              <span>
                {progress.value}/{progress.max} ステップ ({progressPct}%)
              </span>
            )}
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl border bg-card p-3 shrink-0">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">枚数</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={batchCount}
            onChange={(e) =>
              onBatchCountChange(Math.max(1, parseInt(e.target.value) || 1))
            }
            className="h-9 w-20 text-center text-sm"
          />
        </div>

        <Button onClick={onAddToQueue} className="flex-1 gap-2" size="lg">
          <Play className="h-4 w-4" />
          キューに追加
        </Button>

        <Button
          variant="destructive"
          size="lg"
          onClick={onCancel}
          disabled={!isProcessing}
          className="gap-2"
        >
          <StopCircle className="h-4 w-4" />
          中断
        </Button>
      </div>
    </div>
  );
}
