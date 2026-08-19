import fs from "fs";

type TomlValue = string | number | boolean;

/**
 * TOMLの最小シリアライザ（新規npm依存を増やさないための自前実装）。
 * 文字列は全てリテラル文字列（'...'）で出力する — エスケープ処理が不要なため
 * Windowsパスのバックスラッシュをそのまま埋め込める。リテラル文字列は
 * シングルクォート・改行を含められないため、呼び出し側の値は事前にそれらを
 * 含まないことを保証する（sanitizeTomlLiteralを通す）。
 */
export function sanitizeTomlLiteral(value: string): string {
  return value.replace(/'/g, "").replace(/[\r\n]/g, " ");
}

function tomlValue(value: TomlValue): string {
  if (typeof value === "string") return `'${sanitizeTomlLiteral(value)}'`;
  return String(value);
}

function tomlLine(key: string, value: TomlValue): string {
  return `${key} = ${tomlValue(value)}`;
}

export interface DatasetTomlInput {
  imageDir: string;
  numRepeats: number;
  resolution: number;
  batchSize: number;
  captionExtension: string;
}

/** --dataset_config用。image_dirを直接指定するsubset形式なので、指定フォルダ以外を巻き込まない。 */
export function writeDatasetToml(filePath: string, input: DatasetTomlInput): void {
  const lines = [
    "[[datasets]]",
    tomlLine("resolution", input.resolution),
    tomlLine("batch_size", input.batchSize),
    "",
    "  [[datasets.subsets]]",
    `  ${tomlLine("image_dir", input.imageDir)}`,
    `  ${tomlLine("num_repeats", input.numRepeats)}`,
    `  ${tomlLine("caption_extension", input.captionExtension)}`,
  ];
  fs.writeFileSync(filePath, lines.join("\n") + "\n");
}

export interface TrainingTomlInput {
  pretrainedModelPath: string;
  outputDir: string;
  outputName: string;
  networkDim: number;
  networkAlpha: number;
  learningRate: number;
  trainBatchSize: number;
  maxTrainEpochs: number;
  saveEveryNEpochs: number;
  optimizerType: string;
  mixedPrecision: string;
  seed: number;
  captionExtension: string;
  networkTrainUnetOnly: boolean;
}

/** --config_file用。フラットなkey=value。network_module以外は固定のStandard LoRA向けデフォルトを含む。 */
export function writeTrainingToml(filePath: string, input: TrainingTomlInput): void {
  const lines = [
    tomlLine("pretrained_model_name_or_path", input.pretrainedModelPath),
    tomlLine("output_dir", input.outputDir),
    tomlLine("output_name", input.outputName),
    tomlLine("save_model_as", "safetensors"),
    tomlLine("network_module", "networks.lora"),
    tomlLine("network_dim", input.networkDim),
    tomlLine("network_alpha", input.networkAlpha),
    tomlLine("learning_rate", input.learningRate),
    tomlLine("lr_scheduler", "cosine"),
    tomlLine("optimizer_type", input.optimizerType),
    tomlLine("train_batch_size", input.trainBatchSize),
    tomlLine("max_train_epochs", input.maxTrainEpochs),
    tomlLine("save_every_n_epochs", input.saveEveryNEpochs),
    tomlLine("mixed_precision", input.mixedPrecision),
    tomlLine("save_precision", input.mixedPrecision),
    tomlLine("seed", input.seed),
    tomlLine("caption_extension", input.captionExtension),
    // network_train_unet_onlyはstore_trueフラグなので、falseの行は書かず省略する
    // （kohya_gui/lora_gui.pyもconfig_toml_data生成時にFalseの項目を丸ごと除外している）
    ...(input.networkTrainUnetOnly ? [tomlLine("network_train_unet_only", true)] : []),
    tomlLine("enable_bucket", true),
    tomlLine("min_bucket_reso", 256),
    tomlLine("max_bucket_reso", 2048),
    tomlLine("bucket_reso_steps", 64),
    tomlLine("bucket_no_upscale", true),
    tomlLine("sdpa", true),
    tomlLine("gradient_checkpointing", true),
    tomlLine("cache_latents", true),
    tomlLine("max_data_loader_n_workers", 0),
  ];
  fs.writeFileSync(filePath, lines.join("\n") + "\n");
}
