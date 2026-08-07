"use client";
import { useState, useEffect } from "react";
import { type QueueItem, type GenerationSettings } from "@/lib/comfy";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import SamplerSettings from "@/components/sampler-settings";

interface QueueItemEditDialogProps {
  item: QueueItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<QueueItem>) => void;
}

export default function QueueItemEditDialog({
  item,
  onOpenChange,
  onSave,
}: QueueItemEditDialogProps) {
  const [label, setLabel] = useState("");
  const [positivePrompt, setPositivePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [batchCount, setBatchCount] = useState(1);
  const [settings, setSettings] = useState<GenerationSettings | null>(null);

  useEffect(() => {
    if (!item) return;
    setLabel(item.label);
    // ランダムモードの追加行はバッチごとに1行だけ抽選されるため、ここで
    // 全行を平文へ混ぜ込むとpositivePromptBaseとの境界が失われ保存時に
    // 復元できなくなる。"all"モード(常に全行を付加)の時のみ統合表示する
    setPositivePrompt(
      item.additionalPromptMode !== "random" && item.additionalPromptLines.length > 0
        ? `${item.positivePromptBase}\n\n${item.additionalPromptLines.join("\n")}`
        : item.positivePromptBase,
    );
    setNegativePrompt(item.negativePrompt);
    setBatchCount(item.batchCount);
    setSettings(item.settings);
  }, [item]);

  if (!item || !settings) return null;

  const editable = item.status === "pending";

  const handleSave = () => {
    const updates: Partial<QueueItem> = {
      label,
      positivePrompt,
      positivePromptBase: positivePrompt,
      negativePrompt,
      batchCount,
      settings,
    };
    // "all"モードは全行を常に付加するだけなので上の平文へ安全に統合できるが、
    // "random"モードの追加行はこのダイアログに編集用UIが無いため、
    // 触れずに既存のadditionalPromptLines/Modeを保持する
    if (item.additionalPromptMode !== "random") {
      updates.additionalPromptLines = [];
      updates.additionalPromptMode = "all";
    }
    onSave(item.id, updates);
    onOpenChange(false);
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {editable ? "キュー内容の編集" : "キュー内容の確認"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
          <div className="space-y-3 pb-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ラベル</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={!editable}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                ポジティブプロンプト
              </Label>
              <Textarea
                value={positivePrompt}
                onChange={(e) => setPositivePrompt(e.target.value)}
                disabled={!editable}
                rows={7}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                ネガティブプロンプト
              </Label>
              <Textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                disabled={!editable}
                rows={3}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                バッチ枚数
              </Label>
              <Input
                type="number"
                min={1}
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                disabled={!editable}
                className="h-8 w-24 text-sm"
              />
            </div>

            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                サンプラー設定
              </p>
              <fieldset disabled={!editable} className="disabled:opacity-60">
                <SamplerSettings settings={settings} onChange={setSettings} />
              </fieldset>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
          {editable && <Button onClick={handleSave}>保存</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
