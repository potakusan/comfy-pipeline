"use client";
import { useState } from "react";
import type { LoraEntry } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  LoraPickerDialog,
  type LmLoraItem,
} from "@/components/pipeline/lora/lora-picker-dialog";
import TagAutocompleteTextarea from "@/components/common/tag-autocomplete-textarea";
import { Library, Download } from "lucide-react";

export const EMPTY_LORA: LoraEntry = {
  name: "",
  strength: 1.0,
  clipStrength: 1.0,
  triggerWords: "",
};

/**
 * Shared LoRA edit fields (name/picker, strength/CLIP strength, trigger words,
 * and the optional "prompt only" toggle). Used both inside a full dialog
 * (lora-panel.tsx's LoraModal) and inline within a smaller form
 * (lora-section.tsx's LoraSection) — `compact` scales text/spacing down for
 * the latter without duplicating the field logic itself.
 */
export default function LoraFields({
  draft,
  onChange,
  allowPromptOnly,
  allowDanbooruImport,
  compact,
}: {
  draft: LoraEntry;
  onChange: (lora: LoraEntry) => void;
  allowPromptOnly?: boolean;
  allowDanbooruImport?: boolean;
  compact?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [danbooruUrl, setDanbooruUrl] = useState("");
  const [danbooruImporting, setDanbooruImporting] = useState(false);
  const [danbooruError, setDanbooruError] = useState<string | null>(null);

  const set = <K extends keyof LoraEntry>(key: K, val: LoraEntry[K]) =>
    onChange({ ...draft, [key]: val });

  const handlePickerSelect = (item: LmLoraItem) => {
    const triggerWords = item.civitai?.trainedWords?.join(", ") ?? "";
    onChange({ ...draft, name: item.file_name, triggerWords });
  };

  const handleDanbooruImport = async () => {
    const match = danbooruUrl.match(/danbooru\.donmai\.us\/posts\/(\d+)/);
    if (!match) {
      setDanbooruError("Danbooruのポストページ（.../posts/数字）のURLを入力してください");
      return;
    }
    setDanbooruImporting(true);
    setDanbooruError(null);
    try {
      const res = await fetch(`https://danbooru.donmai.us/posts/${match[1]}.json`);
      if (!res.ok) throw new Error(`取得に失敗しました（HTTP ${res.status}）`);
      const data = await res.json();
      const importedTags = [
        ...String(data.tag_string_character ?? "").split(" "),
        ...String(data.tag_string_general ?? "").split(" "),
      ].filter(Boolean);
      if (importedTags.length === 0) {
        setDanbooruError("Character/Generalタグが見つかりませんでした");
        return;
      }
      const existing = draft.triggerWords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const existingSet = new Set(existing);
      const merged = [
        ...existing,
        ...importedTags.filter((t) => !existingSet.has(t)),
      ];
      set("triggerWords", merged.join(", "));
    } catch (e) {
      setDanbooruError(e instanceof Error ? e.message : "取り込みに失敗しました");
    } finally {
      setDanbooruImporting(false);
    }
  };

  const labelClass = compact ? "text-[10px]" : "text-xs";

  return (
    <>
      {allowPromptOnly && (
        <label className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
          <input
            type="checkbox"
            checked={!!draft.isPromptOnly}
            onChange={(e) => set("isPromptOnly", e.target.checked)}
          />
          プロンプトのみ（LoRA無し・フォルダ分け用）
        </label>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className={labelClass}>
            {draft.isPromptOnly
              ? "タイトル（任意の文字列）"
              : compact
                ? "LoRAファイル名"
                : "LoRA名（.safetensors不要）"}
          </Label>
          {!draft.isPromptOnly && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={() => setPickerOpen(true)}
            >
              <Library className="h-3 w-3" />
              {compact ? "選択" : "一覧から選択"}
            </Button>
          )}
        </div>
        <Input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={
            draft.isPromptOnly ? "例: 屋外・私服" : "例: my_character_lora_v1"
          }
          className={compact ? "h-7 font-mono text-xs" : "font-mono text-sm"}
        />
        {!compact && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {draft.isPromptOnly
              ? "実際のLoRAは適用されません。画像の保存フォルダ名として使われます"
              : "ComfyUIのmodels/lorasフォルダ内のファイル名を入力"}
          </p>
        )}
      </div>

      {!draft.isPromptOnly && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className={labelClass}>強度</Label>
              <span className={`font-mono ${labelClass} text-muted-foreground`}>
                {draft.strength.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[draft.strength]}
              onValueChange={([v]) => set("strength", v)}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className={labelClass}>CLIP強度</Label>
              <span className={`font-mono ${labelClass} text-muted-foreground`}>
                {draft.clipStrength.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[draft.clipStrength]}
              onValueChange={([v]) => set("clipStrength", v)}
            />
          </div>
        </div>
      )}

      {allowDanbooruImport && (
        <div>
          <Label className={`mb-1 ${labelClass}`}>Danbooruからインポート</Label>
          <div className="flex gap-1.5">
            <Input
              value={danbooruUrl}
              onChange={(e) => setDanbooruUrl(e.target.value)}
              placeholder="https://danbooru.donmai.us/posts/12345"
              className={compact ? "h-7 font-mono text-xs" : "font-mono text-sm"}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1 text-xs"
              disabled={danbooruImporting || !danbooruUrl.trim()}
              onClick={handleDanbooruImport}
            >
              <Download className="h-3 w-3" />
              {danbooruImporting ? "取込中…" : "取り込み"}
            </Button>
          </div>
          {danbooruError ? (
            <p className="mt-1 text-[10px] text-destructive">{danbooruError}</p>
          ) : (
            !compact && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Character・Generalタグをトリガーワードへ追加します
              </p>
            )
          )}
        </div>
      )}

      <div>
        <Label className={`mb-1 ${labelClass}`}>
          {compact ? "トリガーワード" : "トリガーワード（プロンプトに自動追加）"}
        </Label>
        <TagAutocompleteTextarea
          value={draft.triggerWords}
          onChange={(v) => set("triggerWords", v)}
          placeholder={
            compact
              ? "例: character_name, blue hair, ..."
              : "例: my_character, blue hair, cat ears, ..."
          }
          style={{ minHeight: compact ? "50px" : "70px" }}
        />
      </div>

      <LoraPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
      />
    </>
  );
}
