import { spawn } from "child_process"
import path from "path"
import { appendSetupLog, updateSetupStep } from "@/lib/setup-jobs"
import { detectGpu } from "@/lib/setup/gpu"
import { getComfyUIPath } from "@/lib/setup/config"
import {
  checkPython,
  checkGit,
  checkComfyUIInstalled,
  checkComfyUIVenv,
  checkAutomosaicVenv,
  getComfyUIVenvPython,
  getAutomosaicVenvPython,
} from "@/lib/setup/checker"

function runCommand(
  jobId: string,
  stepId: string,
  cmd: string,
  args: string[],
  cwd?: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: cwd ?? process.cwd(),
      env: { ...process.env },
    })

    proc.stdout?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n").filter(Boolean)) {
        appendSetupLog(jobId, stepId, line)
      }
    })

    proc.stderr?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n").filter(Boolean)) {
        appendSetupLog(jobId, stepId, line)
      }
    })

    proc.on("close", (code) => resolve(code === 0))
    proc.on("error", (err) => {
      appendSetupLog(jobId, stepId, `エラー: ${err.message}`)
      resolve(false)
    })
  })
}

async function step(
  jobId: string,
  stepId: string,
  fn: () => Promise<boolean>,
): Promise<boolean> {
  updateSetupStep(jobId, stepId, { status: "running" })
  const ok = await fn()
  updateSetupStep(jobId, stepId, { status: ok ? "ok" : "failed" })
  return ok
}

export async function runInstallFlow(jobId: string): Promise<void> {
  // ── 1. Python ─────────────────────────────────────────────────────────────
  const pythonCheck = checkPython()
  if (pythonCheck.installed) {
    updateSetupStep(jobId, "python", { status: "skipped" })
    appendSetupLog(jobId, "python", `Python ${pythonCheck.version} 検出済み: ${pythonCheck.path}`)
  } else {
    const ok = await step(jobId, "python", () =>
      runCommand(
        jobId,
        "python",
        "winget",
        [
          "install",
          "Python.Python.3.12",
          "--silent",
          "--accept-source-agreements",
          "--accept-package-agreements",
        ],
      ),
    )
    if (!ok) return
  }

  // ── 2. Git ─────────────────────────────────────────────────────────────────
  const gitCheck = checkGit()
  if (gitCheck.installed) {
    updateSetupStep(jobId, "git", { status: "skipped" })
    appendSetupLog(jobId, "git", `Git ${gitCheck.version} 検出済み`)
  } else {
    const ok = await step(jobId, "git", () =>
      runCommand(
        jobId,
        "git",
        "winget",
        [
          "install",
          "Git.Git",
          "--silent",
          "--accept-source-agreements",
          "--accept-package-agreements",
        ],
      ),
    )
    if (!ok) return
  }

  // ── 3. ComfyUI clone ───────────────────────────────────────────────────────
  const comfyCheck = checkComfyUIInstalled()
  const comfyPath = getComfyUIPath()

  if (comfyCheck.installed) {
    updateSetupStep(jobId, "comfyui", { status: "skipped" })
    appendSetupLog(jobId, "comfyui", `ComfyUI 検出済み: ${comfyPath}`)
  } else {
    const parentDir = path.dirname(comfyPath)
    const repoName = path.basename(comfyPath)
    const ok = await step(jobId, "comfyui", () =>
      runCommand(
        jobId,
        "comfyui",
        "git",
        ["clone", "https://github.com/comfyanonymous/ComfyUI.git", repoName],
        parentDir,
      ),
    )
    if (!ok) return
  }

  // ── 4. ComfyUI venv ────────────────────────────────────────────────────────
  const venvCheck = checkComfyUIVenv()
  if (venvCheck.installed) {
    updateSetupStep(jobId, "venv", { status: "skipped" })
    appendSetupLog(jobId, "venv", `venv 検出済み: ${venvCheck.path}`)
  } else {
    const ok = await step(jobId, "venv", () =>
      runCommand(jobId, "venv", "python", ["-m", "venv", "venv"], comfyPath),
    )
    if (!ok) return
  }

  // ── 5. PyTorch (GPU-specific) ──────────────────────────────────────────────
  const venvPython = getComfyUIVenvPython()
  const gpu = detectGpu()
  appendSetupLog(
    jobId,
    "torch",
    gpu.found
      ? `GPU検出: ${gpu.name} (ドライバ ${gpu.driverVersion}, CUDA ${gpu.cudaVersion})`
      : "NVIDIAのGPUが見つかりませんでした。CPU版PyTorchをインストールします",
  )

  const torchArgs = gpu.torchIndexUrl
    ? [
        "install",
        "torch",
        "torchvision",
        "torchaudio",
        "--index-url",
        gpu.torchIndexUrl,
      ]
    : ["install", "torch", "torchvision", "torchaudio"]

  const torchOk = await step(jobId, "torch", () =>
    runCommand(jobId, "torch", venvPython, ["-m", "pip", ...torchArgs], comfyPath),
  )
  if (!torchOk) return

  // ── 6. ComfyUI requirements ────────────────────────────────────────────────
  const reqOk = await step(jobId, "requirements", () =>
    runCommand(
      jobId,
      "requirements",
      venvPython,
      ["-m", "pip", "install", "-r", "requirements.txt"],
      comfyPath,
    ),
  )
  if (!reqOk) return

  // ── 7. Automosaic venv ─────────────────────────────────────────────────────
  const automosaicCheck = checkAutomosaicVenv()
  const automosaicDir = path.join(process.cwd(), "automosaic")

  if (automosaicCheck.installed) {
    updateSetupStep(jobId, "automosaic", { status: "skipped" })
    appendSetupLog(jobId, "automosaic", "automosaic venv 検出済み")
  } else {
    const venvOk = await step(jobId, "automosaic", async () => {
      const created = await runCommand(
        jobId,
        "automosaic",
        "python",
        ["-m", "venv", "venv"],
        automosaicDir,
      )
      if (!created) return false

      const automosaicPython = getAutomosaicVenvPython()
      return runCommand(
        jobId,
        "automosaic",
        automosaicPython,
        ["-m", "pip", "install", "-r", "requirements.txt"],
        automosaicDir,
      )
    })
    if (!venvOk) return
  }
}
