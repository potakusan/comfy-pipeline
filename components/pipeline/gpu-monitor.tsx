import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SysSnapshot } from "@/hooks/use-sys-monitor";

export type { SysSnapshot };

function GpuStatPill({
  label,
  value,
  unit = "",
  colorClass,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded border bg-card/40 px-1.5 py-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] font-bold ${colorClass}`}>
        {value !== null ? `${value}${unit}` : "—"}
      </span>
    </div>
  );
}

export default function GpuMonitor({
  snapshots,
  collapsed,
  onToggle,
}: {
  snapshots: SysSnapshot[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const latest = snapshots.at(-1) ?? null;
  const hasGpu = snapshots.some((s) => s.gpu !== null);

  const chartData = snapshots.slice(-40).map((s, i) => ({
    i,
    gpu: s.gpu ?? undefined,
    vram: s.vramPct ?? undefined,
  }));

  return (
    <div className="shrink-0 border-t bg-background">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted/30"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          GPU
        </span>
        {latest?.gpuName && (
          <span className="max-w-[120px] truncate text-[10px] text-muted-foreground/70">
            {latest.gpuName}
          </span>
        )}
        <div className="flex flex-1 items-center justify-end gap-1.5">
          {hasGpu && (
            <GpuStatPill
              label="3D"
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
                  /{latest.vramTotal}
                </span>
                <span className="font-normal text-muted-foreground text-[9px]">
                  {" "}
                  MB
                </span>
              </span>
            </div>
          )}
          {collapsed ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2.5">
          {snapshots.length === 0 ? (
            <p className="py-2 text-center text-[10px] text-muted-foreground">
              データ取得中...
            </p>
          ) : (
            <>
              <div className="h-20">
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
                              <div key={i} style={{ color: p.color as string }}>
                                {p.name}: {p.value}%
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {hasGpu && (
                      <Line
                        type="monotone"
                        dataKey="gpu"
                        name="GPU 3D"
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
                        name="VRAM %"
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
                {hasGpu && (
                  <>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="inline-block h-0.5 w-3 rounded bg-green-500" />
                      GPU 3D
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="inline-block h-0.5 w-3 rounded bg-purple-500" />
                      VRAM %
                    </span>
                  </>
                )}
                {!hasGpu && (
                  <span className="text-[10px] text-muted-foreground">
                    GPU未検出
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
