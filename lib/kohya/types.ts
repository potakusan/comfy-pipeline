export type OptimizerType = "AdamW8bit" | "AdamW" | "Lion8bit" | "Prodigy";
export type MixedPrecision = "fp16" | "bf16";

export interface TrainingParams {
  /** LORA_DATASET_DIR配下の "<repeat>_<name>" フォルダ名 */
  datasetFolder: string;
  /** COMFYUI_CHECKPOINT_DIR配下のファイル名 */
  checkpointFileName: string;
  outputName: string;
  resolution: number;
  networkDim: number;
  networkAlpha: number;
  learningRate: number;
  trainBatchSize: number;
  maxTrainEpochs: number;
  saveEveryNEpochs: number;
  optimizerType: OptimizerType;
  mixedPrecision: MixedPrecision;
  seed: number;
  /** trueならtext encoderは学習せずUNetのみ。小規模データセットでのtext encoder過学習・高強度時の崩壊対策。 */
  networkTrainUnetOnly: boolean;
}

export type TrainingStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TrainingJob {
  id: string;
  status: TrainingStatus;
  log: string[];
  startedAt: number;
  finishedAt?: number;
  pid?: number;
  error?: string;
  datasetFolder: string;
  outputName: string;
}
