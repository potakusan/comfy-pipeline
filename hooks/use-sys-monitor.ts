"use client";
import { useState, useEffect, useRef } from "react";

export type SysSnapshot = {
  t: number;
  cpu: number;
  gpu: number | null;
  vramPct: number | null;
  vramUsed: number | null;
  vramTotal: number | null;
  gpuName: string | null;
};

/**
 * /api/process/sysinfo を2秒間隔でポーリングし、直近60件のCPU/GPU/VRAM使用率
 * スナップショットを返す。app/_home.tsx(GpuMonitor)とapp/process/page.tsx
 * (ResourceMonitor)の両方でこのポーリング/state管理がほぼ同一実装だったため
 * 共通化した(表示コンポーネント自体はページごとにUIが異なる—折りたたみ可否・
 * CPU表示の有無等—ため別々のまま残す)。
 */
export function useSysMonitor() {
  const [snapshots, setSnapshots] = useState<SysSnapshot[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/process/sysinfo");
        if (!res.ok) return;
        const data = await res.json();
        setSnapshots((prev) => [
          ...prev.slice(-59),
          {
            t: Date.now(),
            cpu: data.cpu ?? 0,
            gpu: data.gpu ?? null,
            vramPct:
              data.vramUsed != null && data.vramTotal > 0
                ? Math.round((data.vramUsed / data.vramTotal) * 100)
                : null,
            vramUsed: data.vramUsed ?? null,
            vramTotal: data.vramTotal ?? null,
            gpuName: data.gpuName ?? null,
          },
        ]);
      } catch {
        // ignore network errors
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return { snapshots };
}
