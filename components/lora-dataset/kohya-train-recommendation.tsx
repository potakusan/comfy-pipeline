import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles } from "lucide-react";
import type { DatasetInfo } from "@/lib/lora-dataset/types";
import type { Recommendation } from "@/components/lora-dataset/kohya-train-helpers";

export default function KohyaTrainRecommendation({
  dataset,
  recommendation,
  onApply,
  onSetRepeat,
}: {
  dataset: DatasetInfo;
  recommendation: Recommendation;
  onApply: () => void;
  onSetRepeat: (repeat: number) => void;
}) {
  return (
    <Alert>
      <Sparkles />
      <AlertTitle>このデータセットへの推奨設定</AlertTitle>
      <AlertDescription>
        <p>
          画像{dataset.imageCount}枚・平均タグ数{recommendation.avgTagCount.toFixed(1)}個から算出（目安の総ステップ数
          {recommendation.targetSteps}）:
        </p>
        <ul className="list-disc pl-4">
          <li>Network Dim: {recommendation.networkDim} / Alpha: {recommendation.networkAlpha}</li>
          <li>Epoch数: {recommendation.maxTrainEpochs}</li>
          <li>UNetのみ学習: {recommendation.networkTrainUnetOnly ? "ON推奨" : "OFFでも可"}</li>
          <li>
            データセットのrepeat: {recommendation.repeat}
            {recommendation.repeat !== dataset.repeat && `（現在${dataset.repeat}）`}
          </li>
        </ul>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onApply}>
            Dim/Alpha/Epoch数/UNetのみ学習に適用
          </Button>
          {recommendation.repeat !== dataset.repeat && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => onSetRepeat(recommendation.repeat)}
            >
              Repeat欄に反映（上の「保存」で確定）
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
