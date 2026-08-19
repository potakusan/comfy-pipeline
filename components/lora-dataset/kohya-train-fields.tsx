import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import type { OptimizerType, MixedPrecision, TrainingParams } from "@/lib/kohya/types";

export interface CheckpointItem {
  fileName: string;
  name: string;
}

export const FIELD_HELP = {
  repeat: "1epochで各画像を学習に使う回数（データセットのrepeat設定）。画像が少ないのに高くしすぎると同じ画像を何度も見て過学習しやすくなります。",
  checkpoint: "学習のベースにするcheckpoint。WAI-IllustriousなどSDXL系のモデルを選んでください。",
  outputName: "生成されるLoRAファイル名（.safetensors）。トリガーワード欄の初期値としても使われます。",
  resolution: "学習時の画像解像度。SDXL系ベースモデルなら1024が基本です。上げるほどVRAMを消費します。",
  mixedPrecision: "学習時の演算精度。bf16はfp16より数値的に安定しており、基本はbf16で問題ありません。",
  networkDim: "LoRAの表現力（学習容量）。大きいほど細部を覚えられますが、画像が少ないと過学習しやすくなります。目安: 〜20枚なら8〜16、50枚以上なら32。",
  networkAlpha: "LoRAの実効的な強さを決める調整値。Network Dimの半分程度にするのが一般的な目安です。",
  learningRate: "1ステップごとの重み更新の大きさ。高いほど学習は速いですが不安定になりやすく、1e-4(0.0001)が標準的な初期値です。",
  batchSize: "1ステップで同時に学習する画像枚数。増やすほど総ステップ数が減るので、その分epoch数を増やすなどの調整が必要です。",
  maxTrainEpochs: "データセット全体を何周学習するか。多すぎると過学習、少なすぎると特徴を覚えきれません。",
  saveEveryNEpochs: "この間隔でLoRAファイルを保存します。複数epoch分を見比べて一番良いものを選べます。",
  optimizer: "重み更新アルゴリズム。AdamW8bitはVRAM消費を抑えつつ安定して学習できる定番の選択です。",
  networkTrainUnetOnly: "ONだとtext encoderは学習せずUNetのみ更新します。小規模データセットでの過学習・LoRA強度を上げたときの崩壊を防ぎやすくなります。",
  randomizeSeed: "OFFにすると同じシードで学習を再現できます（設定を比較したいときに使用）。通常はONのままで問題ありません。",
} as const;

export function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" tabIndex={-1} className="text-muted-foreground hover:text-foreground">
            <HelpCircle className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{help}</TooltipContent>
      </Tooltip>
    </span>
  );
}

export default function KohyaTrainFields({
  params,
  set,
  checkpoints,
  checkpointFileName,
  onCheckpointFileNameChange,
  randomizeSeed,
  onRandomizeSeedChange,
  running,
}: {
  params: Omit<TrainingParams, "checkpointFileName">;
  set: <K extends keyof Omit<TrainingParams, "checkpointFileName">>(
    key: K,
    value: Omit<TrainingParams, "checkpointFileName">[K],
  ) => void;
  checkpoints: CheckpointItem[];
  checkpointFileName: string;
  onCheckpointFileNameChange: (v: string) => void;
  randomizeSeed: boolean;
  onRandomizeSeedChange: (v: boolean) => void;
  running: boolean;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs">
          <FieldLabel label="ベースモデル" help={FIELD_HELP.checkpoint} />
        </Label>
        <NativeSelect
          size="sm"
          className="w-full"
          value={checkpointFileName}
          onChange={(e) => onCheckpointFileNameChange(e.target.value)}
          disabled={running}
        >
          {checkpoints.length === 0 && <NativeSelectOption value="">読み込み中...</NativeSelectOption>}
          {checkpoints.map((c) => (
            <NativeSelectOption key={c.fileName} value={c.fileName}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">
          <FieldLabel label="出力名" help={FIELD_HELP.outputName} />
        </Label>
        <Input
          value={params.outputName}
          onChange={(e) => set("outputName", e.target.value)}
          disabled={running}
          className="text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">
            <FieldLabel label="解像度" help={FIELD_HELP.resolution} />
          </Label>
          <NativeSelect
            size="sm"
            className="w-full"
            value={params.resolution}
            onChange={(e) => set("resolution", Number(e.target.value))}
            disabled={running}
          >
            {[768, 1024, 1216, 1344].map((r) => (
              <NativeSelectOption key={r} value={r}>
                {r}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            <FieldLabel label="Mixed precision" help={FIELD_HELP.mixedPrecision} />
          </Label>
          <NativeSelect
            size="sm"
            className="w-full"
            value={params.mixedPrecision}
            onChange={(e) => set("mixedPrecision", e.target.value as MixedPrecision)}
            disabled={running}
          >
            <NativeSelectOption value="bf16">bf16</NativeSelectOption>
            <NativeSelectOption value="fp16">fp16</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            <FieldLabel label="Network Dim" help={FIELD_HELP.networkDim} />
          </Label>
          <Input
            type="number"
            value={params.networkDim}
            onChange={(e) => set("networkDim", Number(e.target.value) || 1)}
            disabled={running}
            className="text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            <FieldLabel label="Network Alpha" help={FIELD_HELP.networkAlpha} />
          </Label>
          <Input
            type="number"
            value={params.networkAlpha}
            onChange={(e) => set("networkAlpha", Number(e.target.value) || 1)}
            disabled={running}
            className="text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            <FieldLabel label="Learning rate" help={FIELD_HELP.learningRate} />
          </Label>
          <Input
            type="number"
            step="0.00001"
            value={params.learningRate}
            onChange={(e) => set("learningRate", Number(e.target.value) || 0)}
            disabled={running}
            className="text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            <FieldLabel label="Batch size" help={FIELD_HELP.batchSize} />
          </Label>
          <Input
            type="number"
            value={params.trainBatchSize}
            onChange={(e) => set("trainBatchSize", Number(e.target.value) || 1)}
            disabled={running}
            className="text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            <FieldLabel label="Epoch数" help={FIELD_HELP.maxTrainEpochs} />
          </Label>
          <Input
            type="number"
            value={params.maxTrainEpochs}
            onChange={(e) => set("maxTrainEpochs", Number(e.target.value) || 1)}
            disabled={running}
            className="text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            <FieldLabel label="何epochごとに保存" help={FIELD_HELP.saveEveryNEpochs} />
          </Label>
          <Input
            type="number"
            value={params.saveEveryNEpochs}
            onChange={(e) => set("saveEveryNEpochs", Number(e.target.value) || 1)}
            disabled={running}
            className="text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            <FieldLabel label="Optimizer" help={FIELD_HELP.optimizer} />
          </Label>
          <NativeSelect
            size="sm"
            className="w-full"
            value={params.optimizerType}
            onChange={(e) => set("optimizerType", e.target.value as OptimizerType)}
            disabled={running}
          >
            {(["AdamW8bit", "AdamW", "Lion8bit", "Prodigy"] as const).map((o) => (
              <NativeSelectOption key={o} value={o}>
                {o}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="col-span-2 flex items-center justify-between">
          <Label className="text-xs">
            <FieldLabel label="UNetのみ学習" help={FIELD_HELP.networkTrainUnetOnly} />
          </Label>
          <Switch
            checked={params.networkTrainUnetOnly}
            onCheckedChange={(v) => set("networkTrainUnetOnly", v)}
            disabled={running}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            <FieldLabel label="シードランダム" help={FIELD_HELP.randomizeSeed} />
          </Label>
          <Switch checked={randomizeSeed} onCheckedChange={onRandomizeSeedChange} disabled={running} />
        </div>
        {!randomizeSeed && (
          <div className="space-y-1">
            <Label className="text-xs">シード</Label>
            <Input
              type="number"
              value={params.seed}
              onChange={(e) => set("seed", Number(e.target.value) || 0)}
              disabled={running}
              className="text-xs"
            />
          </div>
        )}
      </div>
    </>
  );
}
