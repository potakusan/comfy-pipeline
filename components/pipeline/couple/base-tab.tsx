"use client";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import {
  type CoupleConfig,
  type CoupleRegion,
  type CoupleControlNet,
  buildRegionPrompt,
} from "@/lib/comfy/couple";
import { type Preset } from "@/lib/comfy";
import ControlNetSection from "@/components/pipeline/couple/control-net-section";

// ---------------------------------------------------------------------------
// Prompt preview (collapsible)
// ---------------------------------------------------------------------------

function PromptPreview({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border bg-muted/30">
      <button
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <span>生成プロンプトプレビュー</span>
        {open ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      {open && (
        <Textarea
          readOnly
          value={prompt}
          className="rounded-t-none border-0 border-t font-mono text-[10px] text-muted-foreground"
          rows={8}
        />
      )}
    </div>
  );
}

interface PresetPicker {
  presets: Preset[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function BaseTab({
  activeConfig,
  fixedTags,
  negativePrompt,
  onNegativePromptChange,
  countPicker,
  scenePicker,
  onAddRegion,
  onRemoveLastCharacter,
  onUpdateBasePrompt,
  onUpdateRegion,
  onUpdateControlNet,
  assembledPrompt,
  effectiveRegions,
}: {
  activeConfig: CoupleConfig;
  fixedTags: string;
  negativePrompt: string;
  onNegativePromptChange: (v: string) => void;
  countPicker: PresetPicker;
  scenePicker: PresetPicker;
  onAddRegion: () => void;
  onRemoveLastCharacter: () => void;
  onUpdateBasePrompt: (v: string) => void;
  onUpdateRegion: (index: number, updates: Partial<CoupleRegion>) => void;
  onUpdateControlNet: (updates: Partial<CoupleControlNet>) => void;
  assembledPrompt: string;
  effectiveRegions: CoupleRegion[];
}) {
  const selectedCount =
    countPicker.presets.find((p) => p.id === countPicker.selectedId) ?? null;
  const selectedScene =
    scenePicker.presets.find((p) => p.id === scenePicker.selectedId) ?? null;
  const cn = activeConfig.controlNet;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          キャラクター
        </Label>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground"
            onClick={onAddRegion}
            disabled={activeConfig.regions.length >= 5}
            title="キャラを追加"
            aria-label="キャラを追加"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-destructive"
            onClick={onRemoveLastCharacter}
            disabled={activeConfig.regions.length <= 1}
            title="最後のキャラを削除"
            aria-label="最後のキャラを削除"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          固定タグ（通常モードと共有）
        </Label>
        <Textarea
          readOnly
          value={fixedTags}
          className="cursor-not-allowed font-mono text-[10px] text-muted-foreground opacity-60"
          rows={2}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          マルチキャラ専用ベースプロンプト
        </Label>
        <Textarea
          value={activeConfig.basePrompt}
          onChange={(e) => onUpdateBasePrompt(e.target.value)}
          className="font-mono text-xs"
          rows={4}
          placeholder="2girls, holding hands,"
        />
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          人数
          {selectedCount && (
            <Badge variant="secondary" className="ml-1.5 text-[9px]">
              {selectedCount.name}
            </Badge>
          )}
        </Label>
        <div className="flex flex-wrap gap-1">
          {countPicker.presets.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                countPicker.onSelect(countPicker.selectedId === p.id ? null : p.id)
              }
              className={`flex h-7 items-center rounded-md border px-2 text-[11px] font-medium transition-colors ${
                countPicker.selectedId === p.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          シーン
          {selectedScene && (
            <Badge variant="secondary" className="ml-1.5 text-[9px]">
              {selectedScene.name}
            </Badge>
          )}
        </Label>
        <div className="flex flex-wrap gap-1">
          {scenePicker.presets.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                scenePicker.onSelect(scenePicker.selectedId === p.id ? null : p.id)
              }
              className={`flex h-7 items-center rounded-md border px-2 text-[11px] font-medium transition-colors ${
                scenePicker.selectedId === p.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          ネガティブプロンプト
        </Label>
        <Textarea
          value={negativePrompt}
          onChange={(e) => onNegativePromptChange(e.target.value)}
          className="font-mono text-xs"
          rows={3}
        />
      </div>

      <Separator />

      <ControlNetSection
        controlNet={cn}
        regions={activeConfig.regions}
        onUpdateControlNet={onUpdateControlNet}
        onUpdateRegion={onUpdateRegion}
      />

      <Separator />

      <PromptPreview prompt={assembledPrompt} />
      {cn.enabled && (
        <div className="space-y-1 rounded-md border bg-muted/20 px-2.5 py-2">
          <span className="text-[10px] font-semibold text-muted-foreground">
            各キャラプロンプト（RegionalConditioningColorMask）
          </span>
          {effectiveRegions.map((r) => (
            <div key={r.id} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: r.colorHex }}
                />
                <span className="text-[10px] font-medium text-muted-foreground">
                  {r.name}
                </span>
              </div>
              <Textarea
                readOnly
                value={buildRegionPrompt(r) || "（未設定）"}
                className="font-mono text-[10px] text-muted-foreground/80 cursor-default resize-none"
                rows={3}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
