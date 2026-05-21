import { NextResponse } from "next/server";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface GpuInfo {
  util: number;
  vramUsed: number;
  vramTotal: number;
  name: string;
}

// Cache GPU info to avoid hammering nvidia-smi on every request
let gpuCache: { data: GpuInfo | null; ts: number } = { data: null, ts: 0 };
const GPU_CACHE_TTL_MS = 800;

async function queryGpu(): Promise<GpuInfo | null> {
  const now = Date.now();
  if (now - gpuCache.ts < GPU_CACHE_TTL_MS) return gpuCache.data;
  try {
    const { stdout } = await execAsync(
      "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,name --format=csv,noheader,nounits",
      { timeout: 2000 },
    );
    const parts = stdout.trim().split("\n")[0].split(",").map((s) => s.trim());
    if (parts.length < 4) throw new Error("unexpected nvidia-smi output");
    const util = parseInt(parts[0]);
    const vramUsed = parseInt(parts[1]);
    const vramTotal = parseInt(parts[2]);
    const name = parts.slice(3).join(",").trim();
    if (isNaN(util) || isNaN(vramUsed) || isNaN(vramTotal)) throw new Error("parse error");
    const data: GpuInfo = { util, vramUsed, vramTotal, name };
    gpuCache = { data, ts: now };
    return data;
  } catch {
    gpuCache = { data: null, ts: now };
    return null;
  }
}

type CpuTimes = { user: number; nice: number; sys: number; irq: number; idle: number };

function sampleCpus(): CpuTimes[] {
  return os.cpus().map((c) => ({ ...c.times }));
}

function calcCpuPct(s1: CpuTimes[], s2: CpuTimes[]): number {
  let totalIdle = 0;
  let totalTick = 0;
  for (let i = 0; i < s1.length; i++) {
    for (const k of ["user", "nice", "sys", "irq", "idle"] as const) {
      const d = s2[i][k] - s1[i][k];
      totalTick += d;
      if (k === "idle") totalIdle += d;
    }
  }
  return totalTick === 0 ? 0 : Math.round((1 - totalIdle / totalTick) * 100);
}

/** GET /api/process/sysinfo
 *  Returns CPU %, GPU %, VRAM used/total (MiB), GPU name.
 *  When REMOTE_PROCESS_URL is set, proxies to the remote machine (shows remote GPU).
 */
export async function GET() {
  const remoteUrl = process.env.REMOTE_PROCESS_URL;
  if (remoteUrl) {
    try {
      const res = await fetch(`${remoteUrl}/api/process/sysinfo`);
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ cpu: 0, gpu: null, vramUsed: null, vramTotal: null, gpuName: null });
    }
  }
  const s1 = sampleCpus();
  // Start GPU query in parallel with the 100 ms CPU sample window
  const gpuPromise = queryGpu();
  await new Promise((r) => setTimeout(r, 100));
  const s2 = sampleCpus();

  const [gpu] = await Promise.all([gpuPromise]);
  const cpu = calcCpuPct(s1, s2);

  return NextResponse.json({
    cpu,
    gpu: gpu?.util ?? null,
    vramUsed: gpu?.vramUsed ?? null,
    vramTotal: gpu?.vramTotal ?? null,
    gpuName: gpu?.name ?? null,
  });
}
