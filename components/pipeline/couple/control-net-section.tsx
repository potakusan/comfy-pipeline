"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Brush, FileImage } from "lucide-react";
import { type CoupleRegion, type CoupleControlNet } from "@/lib/comfy/couple";
import CompositionDialog from "@/components/pipeline/couple/composition-dialog";

export default function ControlNetSection({
  controlNet,
  regions,
  onUpdateControlNet,
  onUpdateRegion,
}: {
  controlNet: CoupleControlNet;
  regions: CoupleRegion[];
  onUpdateControlNet: (updates: Partial<CoupleControlNet>) => void;
  onUpdateRegion: (index: number, updates: Partial<CoupleRegion>) => void;
}) {
  const [compositionOpen, setCompositionOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          ControlNet + カラーマスク
        </Label>
        <Switch
          checked={controlNet.enabled}
          onCheckedChange={(v) => onUpdateControlNet({ enabled: v })}
          className="scale-75"
        />
      </div>

      {controlNet.enabled && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => setCompositionOpen(true)}
          >
            <Brush className="mr-1.5 h-3 w-3" />
            構図エディタを開く
          </Button>

          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">
              カラーマップの色 (各キャラの塗り色と一致させてください)
            </span>
            {regions.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <span
                  className="h-4 w-4 shrink-0 rounded border"
                  style={{ backgroundColor: r.colorHex }}
                />
                <span className="w-16 truncate text-[10px]">{r.name}</span>
                <input
                  type="color"
                  value={r.colorHex}
                  onChange={(e) => onUpdateRegion(i, { colorHex: e.target.value })}
                  className="h-5 w-8 cursor-pointer rounded border"
                />
                <Input
                  value={r.colorHex}
                  onChange={(e) => onUpdateRegion(i, { colorHex: e.target.value })}
                  className="h-5 flex-1 font-mono text-[10px]"
                  maxLength={7}
                />
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileImage className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">ポーズ:</span>
              <span className="truncate font-mono text-[10px] text-foreground">
                {controlNet.poseImageName ?? "未設定"}
              </span>
              {controlNet.poseImageName && (
                <button
                  className="text-[9px] text-muted-foreground hover:text-destructive"
                  onClick={() => onUpdateControlNet({ poseImageName: null })}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <FileImage className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                カラーマップ:
              </span>
              <span className="truncate font-mono text-[10px] text-foreground">
                {controlNet.colorMapImageName ?? "未設定"}
              </span>
              {controlNet.colorMapImageName && (
                <button
                  className="text-[9px] text-muted-foreground hover:text-destructive"
                  onClick={() => onUpdateControlNet({ colorMapImageName: null })}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              ControlNetモデル
            </Label>
            <Input
              value={controlNet.controlNetModel}
              onChange={(e) =>
                onUpdateControlNet({ controlNetModel: e.target.value })
              }
              className="h-6 font-mono text-[10px]"
              placeholder="illustriousXL_v10.safetensors"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">強度</Label>
              <div className="flex items-center gap-1">
                <Slider
                  value={[controlNet.strength]}
                  onValueChange={([v]) => onUpdateControlNet({ strength: v })}
                  min={0}
                  max={3}
                  step={0.05}
                  className="flex-1"
                />
                <span className="w-7 text-right font-mono text-[10px]">
                  {controlNet.strength.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">開始</Label>
              <div className="flex items-center gap-1">
                <Slider
                  value={[controlNet.startPercent]}
                  onValueChange={([v]) => onUpdateControlNet({ startPercent: v })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="flex-1"
                />
                <span className="w-7 text-right font-mono text-[10px]">
                  {controlNet.startPercent.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">終了</Label>
              <div className="flex items-center gap-1">
                <Slider
                  value={[controlNet.endPercent]}
                  onValueChange={([v]) => onUpdateControlNet({ endPercent: v })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="flex-1"
                />
                <span className="w-7 text-right font-mono text-[10px]">
                  {controlNet.endPercent.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <CompositionDialog
        open={compositionOpen}
        onOpenChange={setCompositionOpen}
        regions={regions}
        currentPoseImageName={controlNet.poseImageName}
        currentColorMapImageName={controlNet.colorMapImageName}
        onApplyPose={(filename) => onUpdateControlNet({ poseImageName: filename })}
        onApplyColorMap={(filename) =>
          onUpdateControlNet({ colorMapImageName: filename })
        }
      />
    </div>
  );
}
