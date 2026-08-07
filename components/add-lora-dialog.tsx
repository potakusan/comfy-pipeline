'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import type { LoraEntry } from '@/lib/comfy';
import type { ModelItem } from '@/lib/model-manager';

export default function AddLoraDialog({
  item,
  onAdd,
  onClose,
}: {
  item: ModelItem;
  onAdd: (entry: LoraEntry) => void;
  onClose: () => void;
}) {
  const [strength, setStrength] = useState(1.0);
  const [clipStrength, setClipStrength] = useState(1.0);
  const [triggerWords, setTriggerWords] = useState(
    (item.trainedWords ?? []).join(', '),
  );

  const appendWord = (word: string) => {
    setTriggerWords((prev) => {
      const clean = prev.trim();
      if (!clean) return word;
      const parts = clean.split(',').map((s) => s.trim());
      if (parts.includes(word)) return prev;
      return `${clean}, ${word}`;
    });
  };

  const handle = () => {
    onAdd({ name: item.name, strength, clipStrength, triggerWords });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[min(95vw,480px)] max-w-none flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm">LoRAを追加</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <p
            className="break-all rounded bg-muted/40 px-2 py-1 font-mono text-xs leading-relaxed"
            title={item.name}
          >
            {item.name}
          </p>

          {/* Strength */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">強度</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {strength.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[strength]}
              onValueChange={([v]) => setStrength(v)}
            />
          </div>

          {/* CLIP strength */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">CLIP強度</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {clipStrength.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[clipStrength]}
              onValueChange={([v]) => setClipStrength(v)}
            />
          </div>

          {/* Trigger words */}
          <div className="space-y-1.5">
            <Label className="text-xs">トリガーワード</Label>
            <Textarea
              value={triggerWords}
              onChange={(e) => setTriggerWords(e.target.value)}
              placeholder="例: my_character, blue hair, ..."
              className="min-h-16 text-xs"
            />

            {/* Civitai trained words chips */}
            {(item.trainedWords ?? []).length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">
                  Civitaiのワード（クリックで追加）:
                </p>
                <div className="flex flex-wrap gap-1">
                  {(item.trainedWords ?? []).map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() => appendWord(word)}
                      className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] hover:border-primary hover:bg-primary/10 hover:text-primary"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            キャンセル
          </Button>
          <Button size="sm" onClick={handle}>
            登録
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
