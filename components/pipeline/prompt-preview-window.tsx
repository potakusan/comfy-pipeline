"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Eye, Shuffle } from "lucide-react";
import FloatingWindow from "@/components/gallery/floating-window";
import type { PromptPreviewPos } from "@/hooks/pipeline/use-pipeline";

export default function PromptPreviewWindow({
  positivePrompt,
  negativePrompt,
  hasRandom,
  isLive,
  onRefresh,
  pos,
  onPosChange,
}: {
  positivePrompt: string;
  negativePrompt: string;
  hasRandom: boolean;
  isLive: boolean;
  onRefresh: () => void;
  pos: PromptPreviewPos;
  onPosChange: (p: PromptPreviewPos) => void;
}) {
  const [tab, setTab] = useState<"positive" | "negative">("positive");

  return (
    <FloatingWindow
      title="プロンプトプレビュー"
      icon={<Eye className="h-3 w-3 text-muted-foreground" />}
      badges={
        <>
          {isLive && (
            <Badge variant="default" className="text-[9px]">
              生成中
            </Badge>
          )}
          {!isLive && hasRandom && (
            <Badge variant="secondary" className="text-[9px]">
              ランダム要素あり
            </Badge>
          )}
        </>
      }
      titleActions={
        !isLive &&
        hasRandom && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            title="ランダム再抽選"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Shuffle className="h-3 w-3" />
          </span>
        )
      }
      pos={pos}
      onPosChange={onPosChange}
      defaultWidth={400}
      defaultHeight={220}
      minWidth={200}
      minHeight={120}
      initialPlacement="bottom-left"
    >
      <div className="flex h-full flex-col">
        <div className="flex gap-1 px-3 pt-2 pb-1.5 shrink-0">
          {(["positive", "negative"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                tab === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {t === "positive" ? "ポジティブ" : "ネガティブ"}
            </button>
          ))}
        </div>
        <div className="mx-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded bg-muted/20 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-foreground/80 select-all">
          {(tab === "positive" ? positivePrompt : negativePrompt) || (
            <span className="text-muted-foreground">（未設定）</span>
          )}
        </div>
      </div>
    </FloatingWindow>
  );
}
