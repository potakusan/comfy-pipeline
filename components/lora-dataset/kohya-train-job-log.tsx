import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { TrainingJob } from "@/lib/kohya/types";

export default function KohyaTrainJobLog({ job }: { job: TrainingJob }) {
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job.log.length]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          状態: {job.status}
          {job.error && ` — ${job.error}`}
        </Label>
        {(job.status === "pending" || job.status === "running") && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      <pre
        ref={logRef}
        className="h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 text-[10px] whitespace-pre-wrap"
      >
        {job.log.join("\n") || "ログはまだありません"}
      </pre>
      {job.status === "completed" && (
        <p className="text-xs text-muted-foreground">
          「{job.outputName}.safetensors」としてLoRAフォルダに保存されました。モデルマネージャーから使用できます
        </p>
      )}
    </div>
  );
}
