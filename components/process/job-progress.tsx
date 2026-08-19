import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { ProcessJob } from "@/lib/process/process-jobs";
import { fmtDuration } from "@/components/process/process-helpers";

export default function JobProgress({
  job,
  logOpen,
  onToggleLog,
}: {
  job: ProcessJob;
  logOpen: boolean;
  onToggleLog: () => void;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  const isRunning = job.status === "running" || job.status === "pending";
  const pct = job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;

  // 同一マウント内でjobが差し替わった場合(再実行等)、経過時間の基準をリセットする
  useEffect(() => {
    setNow(Date.now());
  }, [job.id]);

  // Tick every second while running to keep ETA live
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // ETA: need at least 2 completed images for a meaningful rate
  const elapsed = (now - job.startedAt) / 1000;
  const rate = job.current >= 2 ? job.current / elapsed : null;
  const remaining =
    rate !== null && job.total > job.current
      ? (job.total - job.current) / rate
      : null;

  return (
    <div className="rounded-lg border bg-card/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        {isRunning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {job.status === "completed" && (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
        {job.status === "failed" && (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="text-sm font-medium">
          {isRunning
            ? "処理中..."
            : job.status === "completed"
              ? "完了"
              : "失敗"}
        </span>
        {job.total > 0 && (
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {job.current}/{job.total} ({pct}%)
          </span>
        )}
      </div>

      {isRunning && job.total > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {isRunning && job.total > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px]">
          <span className="text-muted-foreground">
            経過: {fmtDuration(elapsed)}
          </span>
          {remaining !== null ? (
            <span className="font-medium text-foreground">
              残り約 {fmtDuration(remaining)}
            </span>
          ) : (
            <span className="text-muted-foreground">残り: 計算中...</span>
          )}
          {rate !== null && (
            <span className="ml-auto text-muted-foreground">
              {rate.toFixed(2)} 枚/秒
            </span>
          )}
        </div>
      )}

      {job.error && <p className="text-xs text-destructive">{job.error}</p>}

      <button
        onClick={onToggleLog}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {logOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        ログ ({job.log.length} 行)
      </button>
      {logOpen && (
        <div className="max-h-64 overflow-y-auto rounded border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed">
          {job.log.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
