"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import AppHeader from "@/components/common/app-header"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  SkipForward,
  Cpu,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Pencil,
} from "lucide-react"
import type { SetupJob, SetupStepStatus } from "@/lib/setup-jobs"
import type { GpuInfo } from "@/lib/setup/gpu"

interface ComponentStatus {
  installed: boolean
  version?: string
  path?: string
  detail?: string
}

interface StatusData {
  python: ComponentStatus
  git: ComponentStatus
  comfyui: ComponentStatus & { running: boolean; path: string }
  comfyuiVenv: ComponentStatus
  torch: { installed: boolean; version?: string; detail?: string }
  automosaic: ComponentStatus
  gpu: GpuInfo
}

function StepIcon({ status }: { status: SetupStepStatus }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="size-4 text-green-500 shrink-0" />
    case "failed":
      return <XCircle className="size-4 text-destructive shrink-0" />
    case "running":
      return <Loader2 className="size-4 text-blue-400 animate-spin shrink-0" />
    case "skipped":
      return <SkipForward className="size-4 text-muted-foreground shrink-0" />
    default:
      return <Circle className="size-4 text-muted-foreground shrink-0" />
  }
}

function StepRow({ step }: { step: SetupJob["steps"][number] }) {
  const [open, setOpen] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const hasLog = step.log.length > 0

  useEffect(() => {
    if (open && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [step.log, open])

  return (
    <div className="rounded-md border border-border bg-card">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => hasLog && setOpen((v) => !v)}
        disabled={!hasLog}
      >
        <StepIcon status={step.status} />
        <span className="flex-1 text-sm">{step.label}</span>
        {hasLog &&
          (open ? (
            <ChevronDown className="size-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3 text-muted-foreground" />
          ))}
      </button>

      {open && hasLog && (
        <div
          ref={logRef}
          className="max-h-48 overflow-y-auto border-t border-border bg-black/30 px-3 py-2"
        >
          {step.log.map((line, i) => (
            <p key={i} className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function LaunchButton() {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href="/"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        "relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-lg px-6 py-4",
        "bg-linear-to-r from-violet-600 via-fuchsia-500 to-pink-500",
        "text-white font-bold text-lg tracking-wide shadow-lg",
        "transition-all duration-300",
        hovered
          ? "scale-[1.02] shadow-[0_0_32px_rgba(168,85,247,0.6)]"
          : "shadow-[0_0_16px_rgba(168,85,247,0.3)]",
      ].join(" ")}
    >
      {/* shimmer overlay */}
      <span
        className={[
          "pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/20 to-transparent",
          "transition-transform duration-700",
          hovered ? "translate-x-full" : "-translate-x-full",
        ].join(" ")}
      />
      <span className={`transition-transform duration-300 ${hovered ? "-translate-x-1" : ""}`}>
        🚀
      </span>
      <span>メイン画面を開く</span>
      <span
        className={`transition-all duration-300 ${hovered ? "translate-x-1 opacity-100" : "opacity-60"}`}
      >
        →
      </span>
    </a>
  )
}

function StatusRow({
  label,
  ok,
  extra,
  detail,
  warning,
}: {
  label: string
  ok: boolean
  extra?: string
  detail?: string
  warning?: boolean
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-green-500 shrink-0" />
      ) : warning ? (
        <Circle className="size-4 text-yellow-500 shrink-0" />
      ) : (
        <XCircle className="size-4 text-destructive shrink-0" />
      )}
      <span className="w-36 text-sm font-medium shrink-0">{label}</span>
      {extra && <span className="text-xs text-muted-foreground">{extra}</span>}
      {detail && (
        <span className="ml-auto text-xs text-muted-foreground truncate max-w-xs" title={detail}>
          {detail}
        </span>
      )}
    </div>
  )
}

export default function SetupPage() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [job, setJob] = useState<SetupJob | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ComfyUI path edit state
  const [editingPath, setEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState("")
  const [savingPath, setSavingPath] = useState(false)

  async function fetchStatus() {
    setLoadingStatus(true)
    try {
      const res = await fetch("/api/setup/status")
      const data: StatusData = await res.json()
      setStatus(data)
      if (!editingPath) setPathInput(data.comfyui.path)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    if (!jobId) return
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/setup/progress/${jobId}`)
      if (!res.ok) return
      const data: SetupJob = await res.json()
      setJob(data)
      if (data.status === "completed" || data.status === "failed") {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        fetchStatus()
      }
    }, 1000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [jobId])

  async function savePath() {
    setSavingPath(true)
    try {
      await fetch("/api/setup/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comfyuiPath: pathInput }),
      })
      setEditingPath(false)
      await fetchStatus()
    } finally {
      setSavingPath(false)
    }
  }

  async function startInstall() {
    const res = await fetch("/api/setup/install", { method: "POST" })
    const { jobId: id } = await res.json()
    setJobId(id)
    setJob(null)
  }

  const isInstalling = job?.status === "running"
  const isDone = job?.status === "completed"
  const hasFailed = job?.status === "failed"

  const needsInstall = status
    ? !status.python.installed ||
      !status.git.installed ||
      !status.comfyui.installed ||
      (!status.comfyuiVenv.installed && !status.comfyui.running) ||
      !status.torch.installed ||
      !status.automosaic.installed
    : false

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="setup" />
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-bold">セットアップ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ComfyPipelineの動作に必要なコンポーネントをチェック・インストールします
          </p>
        </div>

        {/* GPU Info */}
        {status && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3">
            <Cpu className="size-4 text-muted-foreground shrink-0" />
            {status.gpu.found ? (
              <>
                <span className="text-sm font-medium">{status.gpu.name}</span>
                <span className="text-xs text-muted-foreground">
                  ドライバ {status.gpu.driverVersion} / CUDA {status.gpu.cudaVersion}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                NVIDIAのGPUが検出されませんでした（CPU版になります）
              </span>
            )}
          </div>
        )}

        {/* ComfyUI Path Config */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            ComfyUI フォルダパス
          </h2>
          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            {editingPath ? (
              <div className="flex gap-2">
                <Input
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  placeholder="例: C:\Users\admin\ComfyUI"
                  className="flex-1 font-mono text-xs"
                />
                <Button size="sm" onClick={savePath} disabled={savingPath}>
                  {savingPath ? <Loader2 className="size-3 animate-spin" /> : "保存"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingPath(false); setPathInput(status?.comfyui.path ?? "") }}>
                  キャンセル
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
                  {status?.comfyui.path ?? "..."}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditingPath(true)}>
                  <Pencil className="size-3 mr-1" />
                  変更
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              ComfyUIのmain.pyがあるフォルダを指定してください。StabilityMatrix等を使っている場合はそのパスに変更してください。
            </p>
          </div>
        </div>

        {/* Status Checklist */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            コンポーネント状態
          </h2>
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              確認中...
            </div>
          ) : status ? (
            <div className="space-y-1.5">
              <StatusRow
                label="Python"
                ok={status.python.installed}
                extra={status.python.version}
              />
              <StatusRow
                label="Git"
                ok={status.git.installed}
                extra={status.git.version}
              />
              <StatusRow
                label="ComfyUI"
                ok={status.comfyui.installed}
                extra={
                  status.comfyui.running
                    ? "起動中"
                    : status.comfyui.installed
                    ? "停止中"
                    : "未検出"
                }
                warning={!status.comfyui.installed && status.comfyui.running}
              />
              <StatusRow
                label="ComfyUI venv"
                ok={status.comfyuiVenv.installed || status.comfyui.running}
                extra={
                  status.comfyui.running
                    ? "ComfyUI起動中のためスキップ"
                    : status.comfyuiVenv.installed
                    ? "検出済み"
                    : "未検出"
                }
              />
              <StatusRow
                label="PyTorch"
                ok={status.torch.installed}
                extra={status.torch.version}
                detail={status.torch.detail}
              />
              <StatusRow
                label="automosaic"
                ok={status.automosaic.installed}
                extra={status.automosaic.installed ? "venv検出済み" : "未セットアップ"}
              />
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        {!job && status && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {needsInstall ? (
                <Button onClick={startInstall} disabled={isInstalling}>
                  自動インストール開始
                </Button>
              ) : (
                <Button disabled className="cursor-default">
                  ✓ セットアップ完了
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loadingStatus}>
                再確認
              </Button>
            </div>
            <LaunchButton />
          </div>
        )}

        {/* Job Progress */}
        {job && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">インストール進捗</h2>
              {isInstalling && <Loader2 className="size-4 animate-spin text-blue-400" />}
              {isDone && <CheckCircle2 className="size-4 text-green-500" />}
              {hasFailed && <XCircle className="size-4 text-destructive" />}
            </div>

            <div className="space-y-1.5">
              {job.steps.map((step) => (
                <StepRow key={step.id} step={step} />
              ))}
            </div>

            {(isDone || hasFailed) && (
              <div className="space-y-3">
                {isDone && <LaunchButton />}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setJob(null)
                    setJobId(null)
                    fetchStatus()
                  }}
                >
                  閉じて再確認
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
