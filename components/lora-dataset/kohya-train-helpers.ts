import type { TrainingParams } from "@/lib/kohya/types";
import type { DatasetInfo } from "@/lib/lora-dataset/types";

export function defaultParams(dataset: DatasetInfo): Omit<TrainingParams, "checkpointFileName"> {
  return {
    datasetFolder: dataset.folder,
    outputName: dataset.name,
    resolution: 1024,
    networkDim: 32,
    networkAlpha: 16,
    learningRate: 0.0001,
    trainBatchSize: 1,
    maxTrainEpochs: 10,
    saveEveryNEpochs: 2,
    optimizerType: "AdamW8bit",
    mixedPrecision: "bf16",
    seed: 42,
    // 小規模データセットではtext encoderまで学習すると過学習・高強度時の崩壊につながりやすいため、
    // UNetのみ学習をデフォルトにしている（必要ならOFFにできる）。
    networkTrainUnetOnly: true,
  };
}

export interface Recommendation {
  networkDim: number;
  networkAlpha: number;
  repeat: number;
  maxTrainEpochs: number;
  networkTrainUnetOnly: boolean;
  targetSteps: number;
  avgTagCount: number;
}

/** データセットの枚数・平均タグ数から、過学習/未学習になりにくい設定を大まかに提案する。 */
export function recommendSettings(imageCount: number, avgTagCount: number): Recommendation {
  let networkDim: number;
  let repeat: number;
  let targetSteps: number;
  let networkTrainUnetOnly: boolean;

  if (imageCount < 20) {
    networkDim = 8;
    repeat = 3;
    targetSteps = 1000;
    networkTrainUnetOnly = true;
  } else if (imageCount < 50) {
    networkDim = 16;
    repeat = 2;
    targetSteps = 1500;
    networkTrainUnetOnly = true;
  } else {
    networkDim = 32;
    repeat = 1;
    targetSteps = 2000;
    networkTrainUnetOnly = false;
  }

  const maxTrainEpochs = Math.max(4, Math.round(targetSteps / (imageCount * repeat)));
  return {
    networkDim,
    networkAlpha: Math.max(1, Math.round(networkDim / 2)),
    repeat,
    maxTrainEpochs,
    networkTrainUnetOnly,
    targetSteps,
    avgTagCount,
  };
}
