import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { getComfyUIPath, getComfyUIUrl } from "@/lib/setup/config"

export interface ComponentStatus {
  installed: boolean
  version?: string
  path?: string
  detail?: string
}

function tryExec(cmd: string, timeout = 5000): string | null {
  try {
    return execSync(cmd, { timeout, encoding: "utf8", stdio: "pipe" }).trim()
  } catch {
    return null
  }
}

export function checkPython(): ComponentStatus {
  const candidates = process.platform === "win32"
    ? ["python", "python3", "py -3"]
    : ["python3", "python"]

  for (const cmd of candidates) {
    const out = tryExec(`${cmd} --version`)
    if (!out) continue
    const match = out.match(/Python (\d+\.\d+\.\d+)/)
    if (!match) continue

    const exePath = tryExec(`${cmd} -c "import sys; print(sys.executable)"`)
    return { installed: true, version: match[1], path: exePath ?? undefined }
  }
  return { installed: false }
}

export function checkGit(): ComponentStatus {
  const out = tryExec("git --version")
  if (!out) return { installed: false }
  const match = out.match(/git version ([\d.]+)/)
  return { installed: true, version: match?.[1] }
}

export function checkComfyUIInstalled(): ComponentStatus {
  const comfyPath = getComfyUIPath()
  const mainPy = path.join(comfyPath, "main.py")
  if (!fs.existsSync(mainPy)) return { installed: false }
  return { installed: true, path: comfyPath }
}

export async function checkComfyUIRunning(): Promise<boolean> {
  const url = getComfyUIUrl()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

export function checkPyTorch(pythonExe: string): ComponentStatus {
  const out = tryExec(
    `"${pythonExe}" -c "import torch; print(torch.__version__); print(torch.cuda.is_available())"`,
    15000,
  )
  if (!out) return { installed: false }
  const lines = out.split("\n")
  return {
    installed: true,
    version: lines[0],
    detail: lines[1]?.trim() === "True" ? "CUDA有効" : "CPU only",
  }
}

export function getComfyUIVenvPython(): string {
  const comfyPath = getComfyUIPath()
  return process.platform === "win32"
    ? path.join(comfyPath, "venv", "Scripts", "python.exe")
    : path.join(comfyPath, "venv", "bin", "python")
}

export function checkComfyUIVenv(): ComponentStatus {
  const venvPython = getComfyUIVenvPython()
  if (!fs.existsSync(venvPython)) return { installed: false }
  return { installed: true, path: venvPython }
}

export function getAutomosaicVenvPython(): string {
  return process.platform === "win32"
    ? path.join(process.cwd(), "automosaic", "venv", "Scripts", "python.exe")
    : path.join(process.cwd(), "automosaic", "venv", "bin", "python")
}

export function checkAutomosaicVenv(): ComponentStatus {
  const venvPython = getAutomosaicVenvPython()
  if (!fs.existsSync(venvPython)) return { installed: false }
  return { installed: true, path: venvPython }
}
