import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import StatPill from "@/components/process/stat-pill";
import type { SysSnapshot } from "@/components/process/process-helpers";

export default function ResourceMonitor({ snapshots }: { snapshots: SysSnapshot[] }) {
  const latest = snapshots.at(-1) ?? null;
  const hasGpu = snapshots.some((s) => s.gpu !== null);

  const chartData = snapshots.slice(-40).map((s, i) => ({
    i,
    cpu: s.cpu,
    gpu: s.gpu ?? undefined,
    vram: s.vramPct ?? undefined,
  }));

  return (
    <div className="shrink-0 border-b px-4 py-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          システム
        </span>
        <StatPill
          label="CPU"
          value={latest?.cpu ?? null}
          unit="%"
          colorClass="text-blue-500"
        />
        {hasGpu && (
          <StatPill
            label="GPU"
            value={latest?.gpu ?? null}
            unit="%"
            colorClass="text-green-500"
          />
        )}
        {hasGpu && latest?.vramUsed != null && latest.vramTotal != null && (
          <div className="flex items-center gap-1 rounded border bg-card/40 px-1.5 py-0.5">
            <span className="text-[10px] text-muted-foreground">VRAM</span>
            <span className="font-mono text-[11px] font-bold text-purple-500">
              {latest.vramUsed}
              <span className="font-normal text-muted-foreground">
                /{latest.vramTotal} MB
              </span>
            </span>
          </div>
        )}
        {latest?.gpuName && (
          <span className="ml-auto max-w-[160px] truncate text-[10px] text-muted-foreground">
            {latest.gpuName}
          </span>
        )}
      </div>

      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 2, right: 2, bottom: 0, left: 0 }}
          >
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded border bg-background px-2 py-1 text-[10px] shadow">
                    {payload.map((p, i) => (
                      <div key={i} style={{ color: p.color }}>
                        {p.name}: {p.value}%
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="cpu"
              name="CPU"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
            {hasGpu && (
              <Line
                type="monotone"
                dataKey="gpu"
                name="GPU"
                stroke="#22c55e"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            )}
            {hasGpu && (
              <Line
                type="monotone"
                dataKey="vram"
                name="VRAM"
                stroke="#a855f7"
                dot={false}
                strokeWidth={1}
                strokeDasharray="3 2"
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-0.5 flex gap-3">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block h-0.5 w-3 rounded bg-blue-500" />
          CPU
        </span>
        {hasGpu && (
          <>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="inline-block h-0.5 w-3 rounded bg-green-500" />
              GPU
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="inline-block h-0.5 w-3 rounded bg-purple-500" />
              VRAM
            </span>
          </>
        )}
        {snapshots.length === 0 && (
          <span className="text-[10px] text-muted-foreground">
            データ取得中...
          </span>
        )}
      </div>
    </div>
  );
}
