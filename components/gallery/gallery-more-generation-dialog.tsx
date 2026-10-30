"use client";
import { useState } from "react";
import { Loader2, Play, Shuffle, Square } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type {
  MoreGenerationTarget,
  useMoreGeneration,
} from "@/hooks/gallery/use-more-generation";

function thumbUrl(relPath: string) {
  return `/api/comfy/output/thumbnail?path=${encodeURIComponent(relPath)}`;
}

export default function GalleryMoreGenerationDialog({
  target,
  controller,
  onClose,
}: {
  /** null = 閉じている */
  target: (MoreGenerationTarget & { pose: string }) | null;
  controller: ReturnType<typeof useMoreGeneration>;
  onClose: () => void;
}) {
  const [count, setCount] = useState(4);
  const { phase, total, saved, discarded, progress, previewUrl, error, cancelled } = controller;
  const running = phase === "running";
  const current = Math.min(saved.length + 1, total);

  return (
    <Dialog open={target !== null} onOpenChange={(v) => !v && !running && onClose()}>
      <DialogContent
        showCloseButton={!running}
        className="flex max-h-[88vh] w-full! max-w-xl! flex-col gap-3"
        onInteractOutside={(e) => running && e.preventDefault()}
        onEscapeKeyDown={(e) => running && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="truncate font-mono text-sm">
            あと何枚か生成 — {target?.pose}
          </DialogTitle>
        </DialogHeader>

        {target && (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <p className="text-[11px] text-muted-foreground">
              保存先: <span className="font-mono">{target.folder}/</span>
              <span className="font-mono">{target.prefix}_NNNNN_</span>
              <br />
              プロンプトと変数はそのままで、ランダム部分と seed を1枚ごとに引き直します。連番は既存の続きから振られます。
            </p>

            {phase === "idle" && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <span className="font-semibold">枚数</span>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="h-8 w-24 text-xs"
                  />
                </label>
                <Button
                  size="sm"
                  className="ml-auto gap-1.5"
                  disabled={!(count >= 1)}
                  onClick={() =>
                    void controller.start(target, Math.min(200, Math.max(1, Math.floor(count))))
                  }
                >
                  <Play className="h-3.5 w-3.5" />
                  生成開始
                </Button>
              </div>
            )}

            {phase !== "idle" && (
              <div className="space-y-2 rounded-lg border bg-card/30 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    {running && <Loader2 className="h-3 w-3 animate-spin" />}
                    {running
                      ? `${current} / ${total} 枚目を生成中`
                      : error
                        ? "エラーで停止しました"
                        : cancelled
                          ? "中止しました"
                          : "完了"}
                  </span>
                  <span className="font-mono tabular-nums">
                    保存 {saved.length} / {total}
                    {discarded > 0 && `(破棄 ${discarded})`}
                  </span>
                </div>
                <Progress value={total > 0 ? (saved.length / total) * 100 : 0} />
                {running && (
                  <>
                    <div className="flex h-72 items-center justify-center overflow-hidden rounded bg-black/20">
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
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-[10px] text-muted-foreground">ステップ</span>
                      <div className="flex-1">
                        <Progress
                          value={progress.max > 0 ? (progress.value / progress.max) * 100 : 0}
                        />
                      </div>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                        {progress.value} / {progress.max}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 flex-1 gap-1 text-xs"
                        onClick={() => void controller.redoCurrent()}
                        title="いま生成中の1枚を破棄して、引き直して同じ枚数目をやり直す"
                      >
                        <Shuffle className="h-3 w-3" />
                        この1枚を破棄して再生成
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 flex-1 gap-1 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => void controller.stop()}
                        title="残りの生成を中止(生成済みの画像は残ります)"
                      >
                        <Square className="h-3 w-3" />
                        中止
                      </Button>
                    </div>
                  </>
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            )}

            {saved.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  生成済み ({saved.length})
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {saved.map((p) => (
                    <a
                      key={p}
                      href={`/api/comfy/output/image?path=${encodeURIComponent(p)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={p}
                      className="block aspect-square overflow-hidden rounded border border-border"
                    >
                      <img src={thumbUrl(p)} alt={p} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {phase === "done" && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={controller.reset}>
                  続けて生成
                </Button>
                <Button size="sm" onClick={onClose}>
                  閉じる
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
