import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  createJob,
  updateJob,
  appendLog,
  incrementProgress,
  addProcessedImage,
  addMosaicResult,
} from "@/lib/process/process-jobs";
import { getOutputDir, safePath } from "@/lib/server/output-dir";
import { getRemoteProcessUrl } from "@/lib/setup/config";

function getAutomosaicDir(): string {
  return path.join(process.cwd(), "automosaic");
}

// Guards against two concurrent runs on the same folder (double-click, retry,
// multiple tabs) racing to write/clean up the same temp dir. Keyed by the
// resolved input path. Uses globalThis so a dev hot-reload doesn't drop the
// lock while an already-spawned subprocess is still running.
const g = globalThis as typeof globalThis & { __runningFolders?: Set<string> };
if (!g.__runningFolders) g.__runningFolders = new Set();
const runningFolders = g.__runningFolders;

function getPythonPath(): string {
  const venv = path.join(getAutomosaicDir(), "venv", "Scripts", "python.exe");
  return fs.existsSync(venv) ? venv : "python";
}

/** モデル名はautomosaic/models直下のファイル名でなければならない(パス区切り・絶対パス・上位参照を拒否)。 */
function isValidModelName(name: string): boolean {
  return path.basename(name) === name && name.toLowerCase().endsWith(".pt");
}

function countImages(dir: string): number {
  const IMAGE_EXTS = /\.(png|jpe?g|webp|avif|bmp)$/i;
  let count = 0;
  try {
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (IMAGE_EXTS.test(entry.name)) count++;
      }
    };
    walk(dir);
  } catch {}
  return count;
}

export interface RunRequest {
  folder: string;
  mosaic: {
    enabled: boolean;
    mosaicSize: number;
    autoSize: boolean;
    confidence: number;
    models: string[];
    device: string;
    retinaMasks: boolean;
    useMasks: boolean;
    noMeta: boolean;
    bboxExpand: number;
    targetClasses: string[];
  };
  resize: {
    enabled: boolean;
    scalePercent: number;
    quality: number;
  };
}

/**
 * Spawn a subprocess and stream its output to the job log.
 * onProgress is called for each stdout line — use it to increment counters.
 */
function runProcess(
  jobId: string,
  cmd: string,
  args: string[],
  cwd: string,
  onProgress: ((line: string) => void) | null,
  onDone: (code: number | null) => void,
): void {
  const proc = spawn(cmd, args, {
    cwd,
    shell: false,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });

  proc.stdout.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      appendLog(jobId, line);
      onProgress?.(line);
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split("\n").filter(Boolean);
    for (const line of lines) appendLog(jobId, `[stderr] ${line}`);
  });

  let done = false;
  proc.on("close", (code) => {
    if (done) return;
    done = true;
    onDone(code);
  });
  proc.on("error", (err) => {
    if (done) return;
    done = true;
    appendLog(jobId, `[stderr] プロセス起動に失敗しました: ${err.message}`);
    onDone(null);
  });
}

/**
 * Progress tracker for automosaic.py output. Also correlates the
 * "processing X" / "[検出結果] N件" / "saved to Y" log lines (which always
 * appear in that order per image, since the UI never sets -w > 1) into a
 * MosaicImageResult with the actual saved path and detected region count —
 * never guessed from a naming convention, since automosaic.py appends a
 * numeric suffix on filename collisions.
 */
function mosaicProgress(jobId: string, outputDir: string) {
  let current: { filename: string; regionCount: number } | null = null;
  return (line: string) => {
    if (line.includes("を処理します")) {
      incrementProgress(jobId);
      const match = line.match(/ファイル (.+) を処理します/);
      if (match) {
        const filename = path.basename(match[1].trim());
        addProcessedImage(jobId, filename);
        current = { filename, regionCount: 0 };
      }
      return;
    }
    const countMatch = line.match(/\[検出結果\] (\d+)件/);
    if (countMatch && current) {
      current.regionCount = parseInt(countMatch[1], 10);
      return;
    }
    const savedMatch = line.match(/画像を保存しました: (.+)$/);
    if (savedMatch && current) {
      const savedAbs = savedMatch[1].trim();
      const rel = path.relative(outputDir, savedAbs).split(path.sep).join("/");
      addMosaicResult(jobId, {
        filename: current.filename,
        regionCount: current.regionCount,
        outputPath: rel,
      });
      current = null;
    }
  };
}

/** Progress tracker for resize.py output */
function resizeProgress(jobId: string) {
  return (line: string) => {
    if (line.includes("リサイズ完了:")) {
      incrementProgress(jobId);
      const match = line.match(/リサイズ完了: (.+?) \(/);
      if (match) addProcessedImage(jobId, path.basename(match[1].trim()));
    }
  };
}

/**
 * Kicks off a resize+mosaic job (execution order: resize first, then
 * mosaic — mosaic works on the smaller resized images, minimising I/O).
 * When REMOTE_PROCESS_URL is configured, forwards to the remote machine.
 * Returns immediately with a jobId; the actual work runs in the background
 * and is tracked via lib/process-jobs.ts (poll via GET /api/process/status/:jobId).
 */
export async function startProcessRun(
  body: RunRequest,
): Promise<{ jobId: string } | { error: string; status: number }> {
  const { folder, mosaic, resize } = body;

  const remoteUrl = getRemoteProcessUrl();
  if (remoteUrl) {
    const remoteRes = await fetch(`${remoteUrl}/api/process/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!remoteRes.ok) {
      const text = await remoteRes.text();
      return { error: `Remote error: ${text}`, status: 502 };
    }
    const data = await remoteRes.json();
    if (!data.jobId) return { error: "Remote returned no jobId", status: 502 };
    return { jobId: `remote:${data.jobId}` };
  }

  if (!folder) return { error: "folder required", status: 400 };
  if (!mosaic.enabled && !resize.enabled)
    return { error: "no operation selected", status: 400 };
  if (mosaic.enabled) {
    const invalidModel = mosaic.models.find((m) => !isValidModelName(m));
    if (invalidModel)
      return { error: `Invalid model name: ${invalidModel}`, status: 400 };
  }

  const outputDir = getOutputDir();
  const inputPath = safePath(outputDir, folder);
  if (!inputPath) return { error: "Invalid path", status: 400 };

  if (runningFolders.has(inputPath)) {
    return { error: "このフォルダは既に処理中です", status: 409 };
  }
  runningFolders.add(inputPath);

  const mosaicOutputDir = path.join(inputPath, "mosaic");
  const automosaicDir = getAutomosaicDir();
  const python = getPythonPath();

  const total = countImages(inputPath);
  const jobId = crypto.randomUUID();
  // jobIDを含めてジョブごとに一意にし、同一フォルダへの多重実行が
  // 互いの一時ファイルを削除し合わないようにする
  const tempResizeDir = path.join(inputPath, `_resize_tmp_${jobId}`);
  createJob(jobId, total);
  updateJob(jobId, { status: "running" });

  (async () => {
    try {
      // -----------------------------------------------------------------------
      // Step 1: Resize  (runs FIRST so mosaic works on smaller images)
      // -----------------------------------------------------------------------
      if (resize.enabled) {
        // When only resizing, put output in "resized/"; when both, use temp dir
        const resizeOutputPath = mosaic.enabled
          ? tempResizeDir
          : path.join(inputPath, "resized");

        appendLog(
          jobId,
          `[resize] 開始: scale=${resize.scalePercent}%, quality=${resize.quality}`,
        );

        const resizeArgs = [
          path.join(automosaicDir, "resize.py"),
          inputPath,
          "-o",
          resizeOutputPath,
          "-s",
          String(resize.scalePercent),
          "-q",
          String(resize.quality),
          // workers: default (CPU count) is fine; no UI knob needed
        ];

        // Track progress only when resize is the sole operation
        const progressFn = mosaic.enabled ? null : resizeProgress(jobId);

        const resizeOk = await new Promise<boolean>((resolve) =>
          runProcess(jobId, python, resizeArgs, automosaicDir, progressFn, (code) =>
            resolve(code === 0),
          ),
        );

        if (!resizeOk) {
          updateJob(jobId, {
            status: "failed",
            error: "Resize failed",
            finishedAt: Date.now(),
          });
          return;
        }
        appendLog(jobId, "[resize] 完了");
      }

      // -----------------------------------------------------------------------
      // Step 2: Mosaic  (applied to resized images if resize ran, else originals)
      // -----------------------------------------------------------------------
      if (mosaic.enabled) {
        const mosaicInputPath = resize.enabled ? tempResizeDir : inputPath;
        appendLog(jobId, `[mosaic] 開始: ${folder}`);

        const models = (
          mosaic.models.length ? mosaic.models : ["pussyV2.pt", "penis.pt"]
        ).join(",");
        const mosaicArgs = [
          "automosaic.py",
          mosaicInputPath,
          "-o",
          mosaicOutputDir,
          "-m",
          models,
          "-s",
          String(mosaic.mosaicSize),
          "-c",
          String(mosaic.confidence),
        ];
        // Per-image auto sizing is handled inside automosaic.py
        if (mosaic.autoSize) mosaicArgs.push("--auto-size");
        if (mosaic.retinaMasks) mosaicArgs.push("--retina_masks");
        if (!mosaic.useMasks) mosaicArgs.push("-bo");
        if (mosaic.noMeta) mosaicArgs.push("-n");
        if (mosaic.device) mosaicArgs.push("-d", mosaic.device);
        if (mosaic.bboxExpand > 0)
          mosaicArgs.push("-e", String(mosaic.bboxExpand / 100));
        if (mosaic.targetClasses.length > 0)
          mosaicArgs.push("--classes", mosaic.targetClasses.join(","));

        const mosaicOk = await new Promise<boolean>((resolve) =>
          runProcess(
            jobId,
            python,
            mosaicArgs,
            automosaicDir,
            mosaicProgress(jobId, outputDir),
            (code) => resolve(code === 0),
          ),
        );

        // Clean up temp resize dir regardless of success/failure
        if (resize.enabled) {
          try {
            fs.rmSync(tempResizeDir, { recursive: true, force: true });
          } catch {}
        }

        if (!mosaicOk) {
          updateJob(jobId, {
            status: "failed",
            error: "Mosaic processing failed",
            finishedAt: Date.now(),
          });
          return;
        }
        appendLog(jobId, "[mosaic] 完了");
      }

      updateJob(jobId, { status: "completed", finishedAt: Date.now() });
    } finally {
      runningFolders.delete(inputPath);
    }
  })();

  return { jobId };
}
