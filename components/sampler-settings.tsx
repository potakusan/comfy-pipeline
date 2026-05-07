'use client'
import { type GenerationSettings, SAMPLER_OPTIONS, SCHEDULER_OPTIONS, SIZE_PRESETS } from '@/lib/comfy'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SamplerSettingsProps {
  settings: GenerationSettings
  onChange: (settings: GenerationSettings) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-24 shrink-0 text-xs text-muted-foreground">{label}</Label>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function SliderWithInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || min)}
        className="h-7 w-16 text-xs"
      />
    </div>
  )
}

export default function SamplerSettings({ settings, onChange }: SamplerSettingsProps) {
  const set = <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) =>
    onChange({ ...settings, [key]: value })

  return (
    <div className="space-y-2.5 text-sm">
      <Row label="チェックポイント">
        <Input
          value={settings.checkpoint}
          onChange={(e) => set('checkpoint', e.target.value)}
          className="h-7 text-xs"
        />
      </Row>

      <Row label="アップスケール">
        <Input
          value={settings.upscaleModel}
          onChange={(e) => set('upscaleModel', e.target.value)}
          className="h-7 text-xs"
        />
      </Row>

      <Row label="サイズ">
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange({ ...settings, width: p.width, height: p.height })}
                className={`rounded px-2 py-0.5 text-[10px] border transition-colors ${
                  settings.width === p.width && settings.height === p.height
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              value={settings.width}
              onChange={(e) => set('width', parseInt(e.target.value) || 512)}
              className="h-7 w-20 text-xs"
              step={64}
            />
            <span className="text-muted-foreground">×</span>
            <Input
              type="number"
              value={settings.height}
              onChange={(e) => set('height', parseInt(e.target.value) || 512)}
              className="h-7 w-20 text-xs"
              step={64}
            />
          </div>
        </div>
      </Row>

      <Row label="シードランダム">
        <Switch
          checked={settings.randomizeSeed}
          onCheckedChange={(v) => set('randomizeSeed', v)}
        />
      </Row>

      {!settings.randomizeSeed && (
        <Row label="シード">
          <Input
            type="number"
            value={settings.seed}
            onChange={(e) => set('seed', parseInt(e.target.value) || 0)}
            className="h-7 text-xs"
          />
        </Row>
      )}

      <Row label="ステップ数">
        <SliderWithInput
          value={settings.steps}
          min={1}
          max={100}
          step={1}
          onChange={(v) => set('steps', v)}
        />
      </Row>

      <Row label="CFG">
        <SliderWithInput
          value={settings.cfg}
          min={1}
          max={20}
          step={0.5}
          onChange={(v) => set('cfg', v)}
        />
      </Row>

      <Row label="サンプラー">
        <Select value={settings.sampler} onValueChange={(v) => set('sampler', v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SAMPLER_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label="スケジューラ">
        <Select value={settings.scheduler} onValueChange={(v) => set('scheduler', v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULER_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label="デノイズ">
        <SliderWithInput
          value={settings.denoise}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set('denoise', v)}
        />
      </Row>
    </div>
  )
}
