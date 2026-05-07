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
import sharp from "sharp";

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
    autoSize: boolean; // auto-calculate size from image dimensions
    confidence: number;
    models: string[]; // e.g. ["pussyV2.pt", "penis.pt"]
    device: string;
    retinaMasks: boolean;
    useMasks: boolean;
    noMeta: boolean;
    bboxExpand: number; // 0-100 (%): expand bbox outward on each side relative to bbox size
    targetClasses: string[]; // e.g. ["nipples","pussy","penis"] — empty = all classes
  };
  resize: {
    enabled: boolean;
    scalePercent: number;
    quality: number;
  };
}

function runProcess(
  jobId: string,
  cmd: string,
  args: string[],
  cwd: string,
  onDone: (code: number | null) => void
): void {
  const proc = spawn(cmd, args, { cwd, shell: false });

  proc.stdout.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      appendLog(jobId, line);
      if (line.includes("を処理します")) {
        incrementProgress(jobId);
        const match = line.match(/ファイル (.+) を処理します/);
        if (match) addProcessedImage(jobId, path.basename(match[1].trim()));
      }
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split("\n").filter(Boolean);
    for (const line of lines) appendLog(jobId, `[stderr] ${line}`);
  });

  proc.on("close", (code) => onDone(code));
}

/** POST /api/process/run
 *  Body: RunRequest
 *  Returns: { jobId }
 */
export async function POST(req: NextRequest) {
  const body: RunRequest = await req.json();
  const { folder, mosaic, resize } = body;

  if (!folder) return NextResponse.json({ error: "folder required" }, { status: 400 });
  if (!mosaic.enabled && !resize.enabled) {
    return NextResponse.json({ error: "no operation selected" }, { status: 400 });
  }

  const outputDir = getOutputDir();
  const inputPath = path.resolve(outputDir, folder);
  if (!inputPath.startsWith(path.resolve(outputDir))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // mosaic output goes inside the source folder
  const mosaicOutputDir = path.join(inputPath, "mosaic");
  const automosaicDir = getAutomosaicDir();
  const python = getPythonPath();

  const total = countImages(inputPath);
  const jobId = crypto.randomUUID();
  createJob(jobId, total * (mosaic.enabled && resize.enabled ? 2 : 1));
  updateJob(jobId, { status: "running" });

  // Run async — don't await
  (async () => {
    // --- Step 1: Mosaic ---
    if (mosaic.enabled) {
      appendLog(jobId, `[mosaic] 開始: ${folder}`);

      // Auto-size: derive mosaic pixel size from the first image's long side
      let computedMosaicSize = mosaic.mosaicSize;
      if (mosaic.autoSize) {
        const IMAGE_EXT_RE = /\.(png|jpe?g|webp|avif|bmp)$/i;
        try {
          const firstFile = fs.readdirSync(inputPath).filter((f) => IMAGE_EXT_RE.test(f)).sort()[0];
          if (firstFile) {
            const meta = await sharp(path.join(inputPath, firstFile)).metadata();
            const longSide = Math.max(meta.width ?? 512, meta.height ?? 512);
            computedMosaicSize = longSide >= 400 ? Math.max(4, Math.round(longSide / 100)) : 4;
            appendLog(jobId, `[mosaic] 自動サイズ: ${computedMosaicSize}px (長辺: ${longSide}px)`);
          }
        } catch {
          appendLog(jobId, `[mosaic] 自動サイズ計算失敗、デフォルト使用: ${computedMosaicSize}px`);
        }
      }

      const models = (mosaic.models.length ? mosaic.models : ["pussyV2.pt", "penis.pt"]).join(",");
      const mosaicArgs = [
        "automosaic.py",
        inputPath,
        "-o", mosaicOutputDir,
        "-m", models,
        "-s", String(computedMosaicSize),
        "-c", String(mosaic.confidence),
      ];
      if (mosaic.retinaMasks) mosaicArgs.push("--retina_masks");
      if (mosaic.useMasks) mosaicArgs.push("-um");
      if (mosaic.noMeta) mosaicArgs.push("-n");
      if (mosaic.device) mosaicArgs.push("-d", mosaic.device);
      if (mosaic.bboxExpand > 0) mosaicArgs.push("-e", String(mosaic.bboxExpand / 100));
      if (mosaic.targetClasses.length > 0) mosaicArgs.push("--classes", mosaic.targetClasses.join(","));

      const mosaicOk = await new Promise<boolean>((resolve) =>
        runProcess(jobId, python, mosaicArgs, automosaicDir, (code) =>
          resolve(code === 0)
        )
      );

      if (!mosaicOk) {
        updateJob(jobId, { status: "failed", error: "Mosaic processing failed", finishedAt: Date.now() });
        return;
      }
      appendLog(jobId, "[mosaic] 完了");
    }

    // --- Step 2: Resize ---
    if (resize.enabled) {
      // If mosaic ran, resize its output; otherwise resize the original folder
      const resizeInput = mosaic.enabled ? mosaicOutputDir : inputPath;
      const resizeOutput = mosaic.enabled ? mosaicOutputDir : path.join(inputPath, "resized");
      appendLog(jobId, `[resize] 開始: scale=${resize.scalePercent}%, quality=${resize.quality}`);

      const resizeArgs = [
        path.join(automosaicDir, "resize.py"),
        resizeInput,
        "-o", resizeOutput,
        "-s", String(resize.scalePercent),
        "-q", String(resize.quality),
      ];

      const resizeOk = await new Promise<boolean>((resolve) =>
        runProcess(jobId, python, resizeArgs, automosaicDir, (code) =>
          resolve(code === 0)
        )
      );

      if (!resizeOk) {
        updateJob(jobId, { status: "failed", error: "Resize failed", finishedAt: Date.now() });
        return;
      }
      appendLog(jobId, "[resize] 完了");
    }

    updateJob(jobId, { status: "completed", finishedAt: Date.now() });
  })();

  return NextResponse.json({ jobId });
}
