import { NextResponse } from "next/server";
import {
  checkPython,
  checkGit,
  checkComfyUIInstalled,
  checkComfyUIRunning,
  checkComfyUIVenv,
  checkPyTorch,
  checkAutomosaicVenv,
  getComfyUIVenvPython,
} from "@/lib/setup/checker";
import { detectGpu } from "@/lib/setup/gpu";
import { getComfyUIPath } from "@/lib/setup/config";

export async function GET() {
  const python = checkPython();
  const git = checkGit();
  const comfyuiPath = getComfyUIPath();
  const comfyui = checkComfyUIInstalled();
  const comfyuiVenv = checkComfyUIVenv();
  const automosaic = checkAutomosaicVenv();
  const gpu = detectGpu();
  const running = await checkComfyUIRunning();

  // PyTorch: if ComfyUI is running it must be installed.
  // If not running, check the venv.
  let torch: { installed: boolean; version?: string; detail?: string };
  if (running) {
    torch = { installed: true, detail: "ComfyUI経由で動作中" };
  } else if (comfyuiVenv.installed) {
    const venvPython = getComfyUIVenvPython();
    const t = checkPyTorch(venvPython);
    torch = { installed: t.installed, version: t.version, detail: t.detail };
  } else {
    torch = { installed: false };
  }

  return NextResponse.json({
    python,
    git,
    comfyui: { ...comfyui, running, path: comfyuiPath },
    comfyuiVenv,
    torch,
    automosaic,
    gpu,
  });
}
