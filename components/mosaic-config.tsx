"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

export const NTD11_MODEL = "ntd11_anime_nsfw_segm_v5-variant1.pt";
export const NTD11_CLASSES = [
  "nipples",
  "pussy",
  "anus",
  "penis",
  "testicles",
  "x-ray",
  "cross-section",
] as const;

export const DEFAULT_MOSAIC = {
  enabled: true,
  mosaicSize: 10,
  autoSize: true,
  confidence: 0.2,
  models: [NTD11_MODEL],
  targetClasses: [
    "pussy",
    "penis",
    "anus",
    "x-ray",
    "cross-section",
  ] as string[],
  device: "",
  retinaMasks: true,
  useMasks: true,
  noMeta: true,
  bboxExpand: 2,
};

export type MosaicConfigValue = typeof DEFAULT_MOSAIC;

export const AVAILABLE_MODELS = [NTD11_MODEL, "pussyV2.pt", "penis.pt"];
export const MODEL_LABELS: Record<string, string> = {
  [NTD11_MODEL]: "ntd11-seg (推奨)",
  "pussyV2.pt": "pussyV2",
  "penis.pt": "penis",
};

export function MosaicConfig({
  config,
  onChange,
}: {
  config: MosaicConfigValue;
  onChange: (c: MosaicConfigValue) => void;
}) {
  const set = <K extends keyof MosaicConfigValue>(
    k: K,
    v: MosaicConfigValue[K],
  ) => onChange({ ...config, [k]: v });

  const toggleModel = (m: string) => {
    const next = config.models.includes(m)
      ? config.models.filter((x) => x !== m)
      : [...config.models, m];
    set("models", next);
  };

  const toggleClass = (cls: string) => {
    const next = config.targetClasses.includes(cls)
      ? config.targetClasses.filter((c) => c !== cls)
      : [...config.targetClasses, cls];
    set("targetClasses", next);
  };

  const hasNtd11 = config.models.includes(NTD11_MODEL);

  return (
    <>
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">
          検出モデル
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_MODELS.map((m) => (
            <button
              key={m}
              onClick={() => toggleModel(m)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                config.models.includes(m)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {MODEL_LABELS[m] ?? m}
            </button>
          ))}
        </div>
      </div>

      {hasNtd11 && (
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">
            検出クラス
            <span className="ml-1 text-muted-foreground/60">(ntd11)</span>
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {NTD11_CLASSES.map((cls) => (
              <button
                key={cls}
                onClick={() => toggleClass(cls)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                  config.targetClasses.includes(cls)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">
            モザイクサイズ
          </Label>
          <button
            onClick={() => set("autoSize", !config.autoSize)}
            className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              config.autoSize
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            自動
          </button>
        </div>
        {config.autoSize ? (
          <p className="rounded border border-dashed border-border bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
            長辺 ÷ 100（最小4px）を自動適用。長辺が400px未満の場合は4px固定。
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Slider
              min={2}
              max={40}
              step={1}
              value={[config.mosaicSize]}
              onValueChange={([v]) => set("mosaicSize", v)}
              className="flex-1"
            />
            <span className="w-8 text-right font-mono text-xs">
              {config.mosaicSize}
            </span>
          </div>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            信頼度しきい値
          </Label>
          <span className="font-mono text-xs">
            {config.confidence.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0.01}
          max={1.0}
          step={0.01}
          value={[config.confidence]}
          onValueChange={([v]) => set("confidence", v)}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            検知範囲の拡張
          </Label>
          <span className="font-mono text-xs">{config.bboxExpand}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[config.bboxExpand]}
          onValueChange={([v]) => set("bboxExpand", v)}
        />
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          検出範囲を bbox
          の幅・高さに対する割合で拡張。セグメンテーションマスクも同量広げる。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">
            デバイス
          </Label>
          <Input
            value={config.device}
            onChange={(e) => set("device", e.target.value)}
            placeholder="自動 (例: 0, cpu)"
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <Switch
              id="retina"
              checked={config.retinaMasks}
              onCheckedChange={(v) => set("retinaMasks", v)}
            />
            <Label htmlFor="retina" className="cursor-pointer text-xs">
              高解像度マスク
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="nometa"
              checked={config.noMeta}
              onCheckedChange={(v) => set("noMeta", v)}
            />
            <Label htmlFor="nometa" className="cursor-pointer text-xs">
              メタデータなし
            </Label>
          </div>
        </div>
      </div>
    </>
  );
}
