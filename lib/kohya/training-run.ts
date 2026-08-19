import { spawn, execFile } from "child_process";
import fs from "fs";
import path from "path";
import { getCheckpointDir, getLoraDir } from "@/lib/setup/config";
import { getDataset, resolveDatasetDir, validateDatasetName } from "@/lib/lora-dataset/dataset-store";
import { formatTag } from "@/lib/lora-dataset/caption-format";
import { getAccelerateExePath, getSdxlTrainScriptPath, getTrainingEnv, validateKohyaInstall } from "@/lib/kohya/paths";
import { writeDatasetToml, writeTrainingToml } from "@/lib/kohya/toml";
import { createTrainingJob, updateTrainingJob, appendTrainingLog, getTrainingJob } from "@/lib/kohya/training-jobs";
import type { TrainingParams } from "@/lib/kohya/types";

const CAPTION_EXTENSION = ".txt";

export function startTraining(params: TrainingParams): { jobId: string } | { error: string } {
  const installError = validateKohyaInstall();
  if (installError) return { error: installError };

  const dataset = getDataset(params.datasetFolder);
  const datasetDir = resolveDatasetDir(params.datasetFolder);
  if (!dataset || !datasetDir) return { error: "データセットが見つかりません" };
  if (dataset.imageCount === 0) return { error: "データセットに画像がありません" };

  const nameError = validateDatasetName(params.outputName);
  if (nameError) return { error: `出力名: ${nameError}` };

  const checkpointDir = getCheckpointDir();
  if (!checkpointDir) return { error: "チェックポイントフォルダが設定されていません" };
  const checkpointFileName = path.basename(params.checkpointFileName);
  const checkpointPath = path.join(checkpointDir, checkpointFileName);
  if (!fs.existsSync(checkpointPath)) return { error: `チェックポイントが見つかりません: ${params.checkpointFileName}` };

  const loraDir = getLoraDir();
  if (!loraDir) return { error: "LoRAフォルダが設定されていません" };
  fs.mkdirSync(loraDir, { recursive: true });

  const job = createTrainingJob(params.datasetFolder, params.outputName.trim());
  const configPrefix = path.join(loraDir, `${params.outputName.trim()}.${job.id.slice(0, 8)}`);
  const datasetTomlPath = `${configPrefix}.dataset.toml`;
  const trainingTomlPath = `${configPrefix}.training.toml`;

  writeDatasetToml(datasetTomlPath, {
    imageDir: datasetDir,
    numRepeats: dataset.repeat,
    resolution: params.resolution,
    batchSize: params.trainBatchSize,
    captionExtension: CAPTION_EXTENSION,
  });
  writeTrainingToml(trainingTomlPath, {
    pretrainedModelPath: checkpointPath,
    outputDir: loraDir,
    outputName: params.outputName.trim(),
    networkDim: params.networkDim,
    networkAlpha: params.networkAlpha,
    learningRate: params.learningRate,
    trainBatchSize: params.trainBatchSize,
    maxTrainEpochs: params.maxTrainEpochs,
    saveEveryNEpochs: params.saveEveryNEpochs,
    optimizerType: params.optimizerType,
    mixedPrecision: params.mixedPrecision,
    seed: params.seed,
    captionExtension: CAPTION_EXTENSION,
    networkTrainUnetOnly: params.networkTrainUnetOnly,
  });

  runAccelerate(job.id, trainingTomlPath, datasetTomlPath, params.mixedPrecision, {
    loraDir,
    outputName: params.outputName.trim(),
    triggerWord: dataset.triggerWord,
  });

  return { jobId: job.id };
}

/**
 * モデルマネージャーが既に読んでいる「<LoRAファイル名>.civitai.json」の
 * {trainedWords} 形式で書く（app/api/models/loras/route.tsのreadCivitaiMeta参照）。
 * ファイル名自体はCivitai由来かどうかを問わないため、自作LoRAでも同じ規約に
 * 乗せるだけでトリガーワードのクリック追加UIがそのまま使えるようになる。
 */
function writeLoraMetadata(loraDir: string, outputName: string, triggerWord: string): void {
  const trigger = formatTag(triggerWord.trim());
  if (!trigger) return;
  const metaPath = path.join(loraDir, `${outputName}.civitai.json`);
  try {
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ modelName: outputName, trainedWords: [trigger], source: "comfy-pipeline-training" }, null, 2),
    );
  } catch {
    // サムネイル同様、メタデータ保存の失敗は学習成功を損なわない非致命的エラー
  }
}

function runAccelerate(
  jobId: string,
  trainingTomlPath: string,
  datasetTomlPath: string,
  mixedPrecision: string,
  output: { loraDir: string; outputName: string; triggerWord: string },
): void {
  const args = [
    "launch",
    "--num_cpu_threads_per_process",
    "2",
    "--mixed_precision",
    mixedPrecision,
    getSdxlTrainScriptPath(),
    "--config_file",
    trainingTomlPath,
    "--dataset_config",
    datasetTomlPath,
  ];

  const proc = spawn(getAccelerateExePath(), args, {
    env: getTrainingEnv(),
    detached: process.platform !== "win32",
  });

  updateTrainingJob(jobId, { status: "running", pid: proc.pid });

  proc.stdout?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n").filter(Boolean)) appendTrainingLog(jobId, line);
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n").filter(Boolean)) appendTrainingLog(jobId, line);
  });

  proc.on("close", (code) => {
    const job = getTrainingJob(jobId);
    if (job?.status === "cancelled") return; // cancelTrainingが既に確定させている
    if (code === 0) writeLoraMetadata(output.loraDir, output.outputName, output.triggerWord);
    updateTrainingJob(jobId, {
      status: code === 0 ? "completed" : "failed",
      finishedAt: Date.now(),
      error: code === 0 ? undefined : `終了コード ${code}`,
    });
  });

  proc.on("error", (err) => {
    appendTrainingLog(jobId, `[エラー] プロセスの起動に失敗しました: ${err.message}`);
    updateTrainingJob(jobId, { status: "failed", finishedAt: Date.now(), error: err.message });
  });
}

/**
 * accelerate launchは実際の学習プロセスを子プロセスとして起動するため、
 * 最上位PIDだけkillしても学習は残り続ける。Windowsはtaskkill /tでツリーごと、
 * それ以外はspawn時にdetachedで作ったプロセスグループへ負のpidでシグナルを送る
 * （kohya_ss自体もclass_command_executor.pyでpsutilにより同様にツリーkillしている）。
 */
export function cancelTraining(jobId: string): boolean {
  const job = getTrainingJob(jobId);
  if (!job || !job.pid || job.status !== "running") return false;

  updateTrainingJob(jobId, { status: "cancelled", finishedAt: Date.now() });
  if (process.platform === "win32") {
    execFile("taskkill", ["/pid", String(job.pid), "/t", "/f"], () => {});
  } else {
    try {
      process.kill(-job.pid, "SIGTERM");
    } catch {
      // 既に終了している等は無視
    }
  }
  return true;
}
