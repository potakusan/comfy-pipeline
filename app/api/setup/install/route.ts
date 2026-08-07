import { NextResponse } from "next/server"
import crypto from "crypto"
import { createSetupJob, updateSetupJob } from "@/lib/setup/setup-jobs"
import { runInstallFlow } from "@/lib/setup/installer"

const STEPS = [
  { id: "python", label: "Python インストール" },
  { id: "git", label: "Git インストール" },
  { id: "comfyui", label: "ComfyUI クローン" },
  { id: "venv", label: "仮想環境作成" },
  { id: "torch", label: "PyTorch インストール (GPU最適化)" },
  { id: "requirements", label: "ComfyUI 依存パッケージ" },
  { id: "automosaic", label: "automosaic 環境セットアップ" },
]

export async function POST() {
  const jobId = crypto.randomUUID()
  createSetupJob(jobId, STEPS.map((s) => ({ ...s, status: "pending" })))
  updateSetupJob(jobId, { status: "running" })

  // Run in background — don't await
  runInstallFlow(jobId)
    .then(() => {
      updateSetupJob(jobId, { status: "completed", finishedAt: Date.now() })
    })
    .catch(() => {
      updateSetupJob(jobId, { status: "failed", finishedAt: Date.now() })
    })

  return NextResponse.json({ jobId })
}
