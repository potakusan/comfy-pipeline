import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_RESIZE, calcAutoScale } from "@/components/process/process-helpers";

export default function ResizeConfig({
  config,
  onChange,
  estimate,
}: {
  config: typeof DEFAULT_RESIZE;
  onChange: (c: typeof DEFAULT_RESIZE) => void;
  estimate: {
    count: number;
    currentBytes: number;
    estimatedBytes: number;
  } | null;
}) {
  const set = <K extends keyof typeof DEFAULT_RESIZE>(
    k: K,
    v: (typeof DEFAULT_RESIZE)[K],
  ) => onChange({ ...config, [k]: v });

  const autoScale =
    config.autoTarget && estimate
      ? calcAutoScale(estimate.currentBytes, config.targetMB)
      : null;

  return (
    <>
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">
            解像度スケール
          </Label>
          <button
            onClick={() => set("autoTarget", !config.autoTarget)}
            className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              config.autoTarget
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            合計サイズ自動
          </button>
        </div>

        {config.autoTarget ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">
                目標合計
              </Label>
              <Input
                type="number"
                min={1}
                max={9999}
                value={config.targetMB}
                onChange={(e) => set("targetMB", Number(e.target.value) || 200)}
                className="h-7 w-24 text-right text-xs"
              />
              <span className="text-xs text-muted-foreground">MB</span>
              {autoScale !== null && (
                <span className="ml-auto font-mono text-sm font-bold">
                  → {autoScale}%
                </span>
              )}
            </div>
            {!estimate && (
              <p className="text-[11px] text-muted-foreground">
                フォルダを選択するとスケールを自動計算します
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Slider
                min={10}
                max={100}
                step={5}
                value={[config.scalePercent]}
                onValueChange={([v]) => set("scalePercent", v)}
                className="flex-1"
              />
              <span className="w-10 text-right font-mono text-sm font-bold">
                {config.scalePercent}%
              </span>
            </div>
          </>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            品質 (JPEG / WebP / AVIF)
          </Label>
          <span className="font-mono text-xs">{config.quality}</span>
        </div>
        <Slider
          min={1}
          max={100}
          step={1}
          value={[config.quality]}
          onValueChange={([v]) => set("quality", v)}
        />
      </div>

      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">
          画像形式の変換
        </Label>
        <div className="flex gap-1">
          {(["keep", "png", "jpg"] as const).map((f) => (
            <button
              key={f}
              onClick={() => set("convertFormat", f)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                config.convertFormat === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {f === "keep" ? "元の形式のまま" : f.toUpperCase()}
            </button>
          ))}
        </div>
        {config.convertFormat === "jpg" && (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">JPEG品質</Label>
              <span className="font-mono text-xs">{config.convertQuality}</span>
            </div>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[config.convertQuality]}
              onValueChange={([v]) => set("convertQuality", v)}
            />
          </div>
        )}
      </div>
    </>
  );
}
