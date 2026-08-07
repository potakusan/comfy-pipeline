"use client";
import { type GalleryImage } from "@/lib/comfy";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { imageUrl, loraShortName, downloadImageMeta } from "@/lib/gallery-display";

export interface ViewerState {
  images: GalleryImage[];
  index: number;
}

export default function GalleryImageViewerDialog({
  viewer,
  onClose,
  onNavigate,
}: {
  viewer: ViewerState | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const selectedImg = viewer ? viewer.images[viewer.index] : null;

  return (
    <Dialog
      open={viewer !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        className="flex h-[92vh] max-h-[92vh] w-full min-w-full flex-col gap-0 p-0"
        onKeyDown={(e) => {
          if (!viewer || viewer.images.length <= 1) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onNavigate(Math.max(0, viewer.index - 1));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            onNavigate(Math.min(viewer.images.length - 1, viewer.index + 1));
          }
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-2.5">
          <DialogTitle className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            <span className="flex-1 truncate font-mono">
              {selectedImg?.path}
            </span>
            <span className="shrink-0 tabular-nums">
              {viewer ? `${viewer.index + 1} / ${viewer.images.length}` : ""}
            </span>
            {selectedImg && (
              <a
                href={imageUrl(selectedImg)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </DialogTitle>
        </DialogHeader>

        {selectedImg && viewer && (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/20 p-3">
              <img
                src={imageUrl(selectedImg)}
                alt={selectedImg.path}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              />

              {viewer.images.length > 1 && (
                <>
                  <button
                    onClick={() => onNavigate(Math.max(0, viewer.index - 1))}
                    disabled={viewer.index === 0}
                    aria-label="前の画像"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white disabled:opacity-20 hover:bg-black/70"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      onNavigate(
                        Math.min(viewer.images.length - 1, viewer.index + 1),
                      )
                    }
                    disabled={viewer.index === viewer.images.length - 1}
                    aria-label="次の画像"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white disabled:opacity-20 hover:bg-black/70"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            <div className="shrink-0 border-t border-border bg-card/50 px-4 py-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {loraShortName(selectedImg.loraName)}
                </Badge>
                {selectedImg.queueLabel && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    {selectedImg.queueLabel}
                  </Badge>
                )}
                {selectedImg.id && (
                  <span className="font-mono text-[9px] text-muted-foreground/50 select-all">
                    {selectedImg.id}
                  </span>
                )}
                <div className="ml-auto">
                  <button
                    onClick={() => downloadImageMeta(selectedImg)}
                    title="メタデータをJSONでダウンロード"
                    className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3 w-3" />
                    JSON
                  </button>
                </div>
              </div>

              {selectedImg.settings && (
                <details className="mb-1 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    サンプラー設定
                  </summary>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 rounded bg-muted/30 p-2 font-mono text-[10px]">
                    {[
                      ["チェックポイント", selectedImg.settings.checkpoint],
                      [
                        "サイズ",
                        `${selectedImg.settings.width}×${selectedImg.settings.height}`,
                      ],
                      ["ステップ", selectedImg.settings.steps],
                      ["CFG", selectedImg.settings.cfg],
                      ["サンプラー", selectedImg.settings.sampler],
                      ["スケジューラ", selectedImg.settings.scheduler],
                      ["デノイズ", selectedImg.settings.denoise],
                      [
                        "シード",
                        selectedImg.settings.randomizeSeed
                          ? "ランダム"
                          : selectedImg.settings.seed,
                      ],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex gap-1">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="truncate">
                          {v as string | number}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {selectedImg.positivePrompt && (
                <details className="mb-1 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    ポジティブプロンプト
                  </summary>
                  <div className="mt-1 max-h-28 overflow-y-auto rounded bg-muted/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-line">
                    {selectedImg.positivePrompt}
                  </div>
                </details>
              )}

              {selectedImg.negativePrompt && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    ネガティブプロンプト
                  </summary>
                  <div className="mt-1 max-h-20 overflow-y-auto rounded bg-muted/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-line">
                    {selectedImg.negativePrompt}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
