import { NextRequest, NextResponse } from "next/server";
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
} from "@/lib/process-jobs";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

function getAutomosaicDir(): string {
  return path.join(process.cwd(), "automosaic");
}

function getPythonPath(): string {
  const venv = path.join(getAutomosaicDir(), "venv", "Scripts", "python.exe");
  return fs.existsSync(venv) ? venv : "python";
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
  const proc = spawn(cmd, args, { cwd, shell: false });

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

  proc.on("close", (code) => onDone(code));
}

/** Progress tracker for automosaic.py output */
function mosaicProgress(jobId: string) {
  return (line: string) => {
    if (line.includes("を処理します")) {
      incrementProgress(jobId);
      const match = line.match(/ファイル (.+) を処理します/);
      if (match) addProcessedImage(jobId, path.basename(match[1].trim()));
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

/** POST /api/process/run
 *  Execution order: resize first (if enabled), then mosaic.
 *  This minimises I/O time because all heavy file I/O happens on smaller images.
 */
export async function POST(req: NextRequest) {
  const body: RunRequest = await req.json();
  const { folder, mosaic, resize } = body;

  if (!folder)
    return NextResponse.json({ error: "folder required" }, { status: 400 });
  if (!mosaic.enabled && !resize.enabled)
    return NextResponse.json(
      { error: "no operation selected" },
      { status: 400 },
    );

  const outputDir = getOutputDir();
  const inputPath = path.resolve(outputDir, folder);
  if (!inputPath.startsWith(path.resolve(outputDir)))
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const mosaicOutputDir = path.join(inputPath, "mosaic");
  // Temp dir used only when both resize + mosaic are enabled
  const tempResizeDir = path.join(inputPath, "_resize_tmp");
  const automosaicDir = getAutomosaicDir();
  const python = getPythonPath();

  const total = countImages(inputPath);
  const jobId = crypto.randomUUID();
  createJob(jobId, total);
  updateJob(jobId, { status: "running" });

  (async () => {
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
      if (mosaic.useMasks) mosaicArgs.push("-um");
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
          mosaicProgress(jobId),
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
  })();

  return NextResponse.json({ jobId });
}
