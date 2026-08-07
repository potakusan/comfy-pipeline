import { execSync } from "child_process";
import fs from "fs";

export interface GpuInfo {
  found: boolean;
  name?: string;
  driverVersion?: string;
  cudaVersion?: string;
  torchIndexUrl: string;
}

// Maps minimum driver version to CUDA version (NVIDIA driver compatibility table)
const DRIVER_CUDA_MAP: Array<{ minDriver: number; cuda: string }> = [
  { minDriver: 572, cuda: "12.8" },
  { minDriver: 560, cuda: "12.6" },
  { minDriver: 545, cuda: "12.3" },
  { minDriver: 527, cuda: "12.0" },
  { minDriver: 520, cuda: "11.8" },
];

function driverToCuda(driverVersion: string): string {
  const major = parseInt(driverVersion.split(".")[0], 10);
  for (const { minDriver, cuda } of DRIVER_CUDA_MAP) {
    if (major >= minDriver) return cuda;
  }
  return "11.7";
}

function cudaToTorchIndex(cudaVersion: string): string {
  const [major, minor] = cudaVersion.split(".").map(Number);
  if (major === 12 && minor >= 8)
    return "https://download.pytorch.org/whl/cu128";
  if (major === 12 && minor >= 6)
    return "https://download.pytorch.org/whl/cu126";
  if (major === 12 && minor >= 4)
    return "https://download.pytorch.org/whl/cu124";
  if (major === 12 && minor >= 1)
    return "https://download.pytorch.org/whl/cu121";
  if (major === 11 && minor >= 8)
    return "https://download.pytorch.org/whl/cu118";
  return "";
}

function findNvidiaSmi(): string {
  // nvidia-smi may not be in PATH on some Windows setups
  const candidates = [
    "nvidia-smi",
    "C:\\Windows\\System32\\nvidia-smi.exe",
    "C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe",
  ];
  for (const cmd of candidates) {
    if (cmd === "nvidia-smi") {
      try {
        execSync("where nvidia-smi", { stdio: "ignore" });
        return cmd;
      } catch {
        continue;
      }
    }
    if (fs.existsSync(cmd)) return `"${cmd}"`;
  }
  return "nvidia-smi";
}

export function detectGpu(): GpuInfo {
  try {
    const nvidiaSmi = findNvidiaSmi();
    const output = execSync(
      `${nvidiaSmi} --query-gpu=name,driver_version --format=csv,noheader`,
      { timeout: 8000, encoding: "utf8" },
    ).trim();

    if (!output) return { found: false, torchIndexUrl: "" };

    const parts = output.split(",").map((s) => s.trim());
    const name = parts[0];
    const driverVersion = parts[1];
    const cudaVersion = driverToCuda(driverVersion);
    const torchIndexUrl = cudaToTorchIndex(cudaVersion);

    return { found: true, name, driverVersion, cudaVersion, torchIndexUrl };
  } catch {
    return { found: false, torchIndexUrl: "" };
  }
}
