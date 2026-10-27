"use client";
import { useEffect, useState } from "react";
import {
  type AdetailerTarget,
  type AdetailerTargetKind,
  newAdetailerTarget,
} from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ChevronDown, Plus, Trash2, AlertCircle } from "lucide-react";

interface DetectorInfo {
  faceDetailer: boolean;
  detectorProvider: boolean;
  models: string[];
}

/** ComfyUI に Impact Pack(FaceDetailer)と検出モデルがあるか、選べる検出モデルは何かを取得する */
function useDetectorInfo() {
  const [info, setInfo] = useState<DetectorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/comfy/detector-models")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DetectorInfo | null) => setInfo(data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);
  return { info, loading };
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
      {label}
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="h-7 text-xs"
      />
    </label>
  );
}

function TargetRow({
  target,
  models,
  onChange,
  onRemove,
}: {
  target: AdetailerTarget;
  models: string[];
  onChange: (patch: Partial<AdetailerTarget>) => void;
  onRemove: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  // 一覧に無い(未導入/別環境の)モデル名も、現在値としては選択肢に残す
  const options =
    models.includes(target.model) || !target.model ? models : [target.model, ...models];

  return (
    <div className="space-y-1.5 rounded-lg border bg-card p-2">
      <div className="flex items-center gap-2">
        <Switch
          checked={target.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
          aria-label={`${target.label}の検出再描画`}
        />
        <Input
          value={target.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-7 flex-1 text-xs font-semibold"
        />
        <button
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="この対象を削除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <NativeSelect
        size="sm"
        value={target.model}
        onChange={(e) => onChange({ model: e.target.value })}
        className="w-full"
      >
        {options.length === 0 && <NativeSelectOption value="">検出モデルなし</NativeSelectOption>}
        {options.map((m) => (
          <NativeSelectOption key={m} value={m}>
            {m}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <Input
        value={target.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        placeholder="専用プロンプト(空なら本体のプロンプトを使う)"
        className="h-7 text-xs"
      />

      <div className="grid grid-cols-3 gap-1.5">
        <NumberField
          label="denoise"
          value={target.denoise}
          step={0.05}
          min={0}
          max={1}
          onChange={(v) => onChange({ denoise: v })}
        />
        <NumberField
          label="検出しきい値"
          value={target.bboxThreshold}
          step={0.05}
          min={0}
          max={1}
          onChange={(v) => onChange({ bboxThreshold: v })}
        />
        <NumberField
          label="steps"
          value={target.steps}
          min={1}
          onChange={(v) => onChange({ steps: v })}
        />
      </div>

      <button
        onClick={() => setDetailOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${detailOpen ? "" : "-rotate-90"}`} />
        詳細設定
      </button>
      {detailOpen && (
        <div className="grid grid-cols-3 gap-1.5">
          <NumberField
            label="領域拡張(px)"
            value={target.dilation}
            onChange={(v) => onChange({ dilation: v })}
          />
          <NumberField
            label="切り出し倍率"
            value={target.cropFactor}
            step={0.5}
            min={1}
            onChange={(v) => onChange({ cropFactor: v })}
          />
          <NumberField
            label="feather"
            value={target.feather}
            min={0}
            onChange={(v) => onChange({ feather: v })}
          />
          <NumberField
            label="目標サイズ"
            value={target.guideSize}
            step={64}
            min={64}
            onChange={(v) => onChange({ guideSize: v })}
          />
          <NumberField
            label="最大サイズ"
            value={target.maxSize}
            step={64}
            min={64}
            onChange={(v) => onChange({ maxSize: v })}
          />
        </div>
      )}
    </div>
  );
}

/**
 * 顔・手などを検出して再描画する(ADetailer 相当)対象を、左カラムで動的に追加・編集する。
 * 生成時は ComfyUI の Impact Pack `FaceDetailer` を SaveImage の直前に対象ごとに挟む。
 */
export default function AdetailerSection({
  targets,
  onChange,
}: {
  targets: AdetailerTarget[];
  onChange: (targets: AdetailerTarget[]) => void;
}) {
  const { info, loading } = useDetectorInfo();
  const unavailable = !loading && (!info || !info.faceDetailer || !info.detectorProvider);

  const patch = (id: string, p: Partial<AdetailerTarget>) =>
    onChange(targets.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const add = (kind: AdetailerTargetKind) => {
    const t = newAdetailerTarget(kind);
    // 既定のモデル名が無い環境では、選べる先頭のモデルにする
    if (info?.models.length && !info.models.includes(t.model)) t.model = info.models[0];
    onChange([...targets, t]);
  };

  return (
    <div className="space-y-2">
      {unavailable && (
        <div className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-[10px] text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            ComfyUI に ComfyUI-Impact-Pack / Impact-Subpack(FaceDetailer・UltralyticsDetectorProvider)が見つかりません。
            導入するまで、ここの対象を有効にして生成するとエラーになります。
          </span>
        </div>
      )}

      {targets.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          対象がありません。下のボタンで顔・手などを追加すると、生成後に検出して再描画します。
        </p>
      )}

      {targets.map((t) => (
        <TargetRow
          key={t.id}
          target={t}
          models={info?.models ?? []}
          onChange={(p) => patch(t.id, p)}
          onRemove={() => onChange(targets.filter((x) => x.id !== t.id))}
        />
      ))}

      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 gap-1 text-xs"
          onClick={() => add("face")}
        >
          <Plus className="h-3 w-3" />
          顔
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 gap-1 text-xs"
          onClick={() => add("hand")}
        >
          <Plus className="h-3 w-3" />手
        </Button>
      </div>
    </div>
  );
}
