"use client";
import { Loader2, X, Shuffle } from "lucide-react";
import FloatingWindow from "@/components/gallery/floating-window";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { FloatingWindowPos } from "@/lib/gallery";

export default function GalleryGeneratingWindow({
  pos,
  onPosChange,
  previewUrl,
  progress,
  onCancel,
  onRetry,
}: {
  pos: FloatingWindowPos;
  onPosChange: (p: FloatingWindowPos) => void;
  previewUrl: string | null;
  progress: { value: number; max: number };
  onCancel: () => void;
  onRetry: () => void;
}) {
  return (
    <FloatingWindow
      title="生成中"
      icon={<Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      pos={pos}
      onPosChange={onPosChange}
      defaultWidth={520}
      defaultHeight={600}
      minHeight={220}
      initialPlacement="center"
    >
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded bg-black/20">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="生成中プレビュー"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <p className="text-[10px] text-muted-foreground">プレビュー待機中...</p>
          )}
        </div>
        <Progress value={progress.max > 0 ? (progress.value / progress.max) * 100 : 0} />
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 gap-1 text-xs"
            onClick={onRetry}
            title="現在の生成を中止し、別シードで作り直す"
          >
            <Shuffle className="h-3 w-3" />
            リトライ（別シード）
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={onCancel}
            title="生成を中止"
          >
            <X className="h-3 w-3" />
            中止
          </Button>
        </div>
      </div>
    </FloatingWindow>
  );
}
