"use client";
import { useState } from "react";
import { type ImageRef, type ImageRefPool } from "@/lib/comfy";
import { comfyInputImageUrl } from "@/lib/comfy-upload";
import { Badge } from "@/components/ui/badge";
import { ImageIcon } from "lucide-react";
import FloatingWindow from "@/components/gallery/floating-window";
import type { PromptPreviewPos } from "@/hooks/pipeline/use-pipeline";

/** プール由来の下絵(`i2i_<hash>.<ext>`)は .i2i 縮小画像を、単一画像は ComfyUI 原寸を返す。 */
function refImageUrl(name: string): string {
  return name.startsWith("i2i_")
    ? `/api/i2i/thumb-for-comfy?name=${encodeURIComponent(name)}`
    : comfyInputImageUrl(name);
}

interface ReferenceImageWindowProps {
  imageRef: ImageRef | null;
  imageRefPool: ImageRefPool | null;
  /** 実行中バッチで実際に採用された下絵のファイル名(なければ null) */
  currentInitImageName: string | null;
  isProcessing: boolean;
  pos: PromptPreviewPos;
  onPosChange: (p: PromptPreviewPos) => void;
}

/**
 * 参照画像(下絵)が指定されているときだけ表示。生成中は「その生成で採用された1枚」、
 * 待機中はプールの説明 or 単一画像を表示する。
 */
export default function ReferenceImageWindow({
  imageRef,
  imageRefPool,
  currentInitImageName,
  isProcessing,
  pos,
  onPosChange,
}: ReferenceImageWindowProps) {
  const [thumbFailed, setThumbFailed] = useState<string | null>(null);
  if (!imageRef && !imageRefPool) return null;

  const shownName = currentInitImageName ?? imageRef?.name ?? null;
  const denoise = imageRefPool?.denoise ?? imageRef?.denoise ?? 0;

  return (
    <FloatingWindow
      title="参照画像"
      icon={<ImageIcon className="h-3 w-3 text-muted-foreground" />}
      badges={
        <Badge variant="secondary" className="text-[9px]">
          {imageRefPool ? `プール ${imageRefPool.names.length}` : "単一"}
          {" · d"}
          {denoise.toFixed(2)}
        </Badge>
      }
      pos={pos}
      onPosChange={onPosChange}
      defaultWidth={240}
      defaultHeight={280}
      minWidth={160}
      minHeight={160}
      initialPlacement="bottom-left"
    >
      <div className="flex h-full flex-col gap-1.5 p-2">
        {shownName ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                thumbFailed === shownName
                  ? comfyInputImageUrl(shownName)
                  : refImageUrl(shownName)
              }
              onError={() => setThumbFailed(shownName)}
              alt="下絵"
              className="min-h-0 w-full flex-1 rounded border object-contain"
            />
            <p className="shrink-0 text-center text-[9px] text-muted-foreground">
              {currentInitImageName
                ? "この生成で採用中"
                : imageRefPool
                  ? "前回採用"
                  : "下絵"}
            </p>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-2 text-center text-[10px] text-muted-foreground">
            {isProcessing
              ? "採用画像を待機中…"
              : `構図プール「${imageRefPool?.group ?? ""}」 ${imageRefPool?.names.length ?? 0}枚。生成ごとにランダムで1枚使います。`}
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
