"use client";
import { useEffect, useState } from "react";
import { Pencil, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TagAutocompleteTextarea from "@/components/common/tag-autocomplete-textarea";
import type { GalleryImageEntry } from "@/lib/gallery";

export default function GalleryPromptPanel({
  entry,
  regenerating = false,
  onRegenerate,
}: {
  entry: GalleryImageEntry | null;
  regenerating?: boolean;
  onRegenerate?: (overrides: {
    positivePrompt: string;
    negativePrompt: string;
    randomizeSeed: boolean;
    seed?: number;
  }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [positivePrompt, setPositivePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [randomizeSeed, setRandomizeSeed] = useState(true);
  const [seedInput, setSeedInput] = useState("");

  // Reset the draft whenever the selected image changes so edits don't leak
  // across images, and drop out of edit mode.
  useEffect(() => {
    setEditing(false);
    setPositivePrompt(entry?.meta?.positivePrompt ?? "");
    setNegativePrompt(entry?.meta?.negativePrompt ?? "");
    setRandomizeSeed(true);
    setSeedInput(String(entry?.meta?.settings?.seed ?? 0));
  }, [entry?.filename]);

  if (!entry) {
    return (
      <p className="p-3 text-center text-xs text-muted-foreground">
        画像を選択してください
      </p>
    );
  }

  const meta = entry.meta;

  if (!meta) {
    return (
      <div className="p-3">
        <p className="text-xs text-muted-foreground">
          この画像にはプロンプト情報が保存されていません（生成後のFSスキャンで見つかった画像など）
        </p>
      </div>
    );
  }

  const startEditing = () => {
    setPositivePrompt(meta.positivePrompt);
    setNegativePrompt(meta.negativePrompt ?? "");
    setRandomizeSeed(true);
    setSeedInput(String(meta.settings?.seed ?? 0));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setPositivePrompt(meta.positivePrompt);
    setNegativePrompt(meta.negativePrompt ?? "");
  };

  const parsedSeed = Number.parseInt(seedInput, 10);
  const seedValid = Number.isFinite(parsedSeed) && parsedSeed >= 0;

  const handleRegenerate = () => {
    onRegenerate?.({
      positivePrompt,
      negativePrompt,
      randomizeSeed,
      seed: randomizeSeed || !seedValid ? undefined : parsedSeed,
    });
    setEditing(false);
  };

  return (
    <div className="space-y-2 overflow-y-auto p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {meta.mode}
        </Badge>
        {meta.queueLabel && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {meta.queueLabel}
          </Badge>
        )}
        {meta.revisionOf && (
          <Badge variant="secondary" className="text-[10px]">
            再生成元: {meta.revisionOf}
          </Badge>
        )}
        {onRegenerate && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 gap-1 px-1.5 text-[10px]"
            disabled={!meta.settings}
            onClick={startEditing}
            title="プロンプトを編集して再生成"
          >
            <Pencil className="h-3 w-3" />
            編集
          </Button>
        )}
      </div>

      {meta.settings && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground">サンプラー設定</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded bg-muted/30 p-2 font-mono text-[10px]">
            {[
              ["チェックポイント", meta.settings.checkpoint],
              ["サイズ", `${meta.settings.width}×${meta.settings.height}`],
              ["ステップ", meta.settings.steps],
              ["CFG", meta.settings.cfg],
              ["サンプラー", meta.settings.sampler],
              ["スケジューラ", meta.settings.scheduler],
              ["デノイズ", meta.settings.denoise],
              ["シード", meta.settings.randomizeSeed ? "ランダム" : meta.settings.seed],
              ...(meta.settings.upscaleSteps > 0
                ? ([["アップスケールseed", meta.settings.upscaleSeed ?? "(未記録)"]] as const)
                : []),
            ].map(([k, v]) => (
              <div key={k as string} className="flex gap-1">
                <span className="text-muted-foreground">{k}:</span>
                <span className="truncate">{v as string | number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing ? (
        <>
          <div>
            <p className="mb-1 font-medium text-muted-foreground">ポジティブプロンプト</p>
            <TagAutocompleteTextarea
              value={positivePrompt}
              onChange={setPositivePrompt}
              className="max-h-40 min-h-20 font-mono text-[10px] leading-relaxed"
            />
          </div>

          <div>
            <p className="mb-1 font-medium text-muted-foreground">ネガティブプロンプト</p>
            <TagAutocompleteTextarea
              value={negativePrompt}
              onChange={setNegativePrompt}
              className="max-h-28 min-h-16 font-mono text-[10px] leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
            <label className="flex items-center gap-1.5 text-[11px]">
              <Checkbox
                checked={randomizeSeed}
                onCheckedChange={(v) => setRandomizeSeed(v === true)}
              />
              ランダムシード
            </label>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground">シード</Label>
              <Input
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value.replace(/[^\d]/g, ""))}
                disabled={randomizeSeed}
                inputMode="numeric"
                className="h-7 w-36 font-mono text-[10px]"
                placeholder={String(meta.settings?.seed ?? 0)}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={
                regenerating ||
                !positivePrompt.trim() ||
                (!randomizeSeed && !seedValid)
              }
              onClick={handleRegenerate}
            >
              <Sparkles className="h-3 w-3" />
              再生成
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={regenerating}
              onClick={cancelEditing}
            >
              <X className="h-3 w-3" />
              キャンセル
            </Button>
          </div>
        </>
      ) : (
        <>
          {meta.positivePrompt && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">ポジティブプロンプト</p>
              <div className="max-h-40 overflow-y-auto rounded bg-muted/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-line">
                {meta.positivePrompt}
              </div>
            </div>
          )}

          {meta.negativePrompt && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">ネガティブプロンプト</p>
              <div className="max-h-28 overflow-y-auto rounded bg-muted/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-line">
                {meta.negativePrompt}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
