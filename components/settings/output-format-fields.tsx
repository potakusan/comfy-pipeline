"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  normalizeOutputImageSettings,
  type OutputFormat,
  type OutputImageSettings,
} from "@/lib/setup/output-format";
import type { SetupConfig } from "@/lib/setup/config";

interface Props {
  config: SetupConfig;
  onChange: (patch: Partial<SetupConfig>) => void;
}

/** 生成画像の保存形式・品質の設定。未設定の項目は既定値(JPG 品質95・4:4:4)で表示する。 */
export default function OutputFormatFields({ config, onChange }: Props) {
  const s: OutputImageSettings = normalizeOutputImageSettings({
    format: config.outputFormat,
    quality: config.outputQuality,
    lossless: config.outputLossless,
    chroma444: config.outputChroma444,
  });
  const lossy = s.format === "jpg" || (s.format === "webp" && !s.lossless);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        ComfyUIはPNGで出力するため、生成直後にここで選んだ形式へ変換して元のPNGを削除します。
        保存済みの画像は変換されません。
      </p>

      <div className="space-y-1">
        <Label htmlFor="outputFormat" className="text-xs">
          保存形式
        </Label>
        <NativeSelect
          id="outputFormat"
          value={s.format}
          onChange={(e) => onChange({ outputFormat: e.target.value as OutputFormat })}
        >
          <NativeSelectOption value="jpg">JPG</NativeSelectOption>
          <NativeSelectOption value="webp">WebP</NativeSelectOption>
          <NativeSelectOption value="png">PNG（変換しない）</NativeSelectOption>
        </NativeSelect>
      </div>

      {s.format === "webp" && (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="outputLossless" className="text-xs">
            ロスレス（劣化なし。サイズはPNGの約7割）
          </Label>
          <Switch
            id="outputLossless"
            checked={s.lossless}
            onCheckedChange={(v) => onChange({ outputLossless: v })}
          />
        </div>
      )}

      {lossy && (
        <div className="space-y-1">
          <Label htmlFor="outputQuality" className="text-xs">
            品質（1〜100）
          </Label>
          <Input
            id="outputQuality"
            type="number"
            min={1}
            max={100}
            value={s.quality}
            onChange={(e) => onChange({ outputQuality: Number(e.target.value) })}
            className="w-28"
          />
        </div>
      )}

      {s.format === "jpg" && (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="outputChroma444" className="text-xs">
            色情報を間引かない（4:4:4。オフは4:2:0で小さくなるが赤などがにじむ）
          </Label>
          <Switch
            id="outputChroma444"
            checked={s.chroma444}
            onCheckedChange={(v) => onChange({ outputChroma444: v })}
          />
        </div>
      )}
    </div>
  );
}
