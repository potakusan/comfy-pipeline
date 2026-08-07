"use client";
import { useState } from "react";
import { type QueueItem } from "@/lib/comfy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import QueueItemEditDialog from "@/components/pipeline/queue/queue-item-edit-dialog";
import {
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  StopCircle,
  Play,
  PlayCircle,
  Pause,
  Pencil,
  RotateCcw,
} from "lucide-react";

interface QueueManagerProps {
  queue: QueueItem[];
  queueRunning: boolean;
  onRemove: (id: string) => void;
  onCancelAllPending: () => void;
  onClearLog: () => void;
  onStart: () => void;
  onPause: () => void;
  onEdit: (id: string, updates: Partial<QueueItem>) => void;
  onRunNext: (id: string) => void;
  onRequeue: (id: string) => void;
}

const STATUS_CONFIG = {
  pending: {
    label: "待機中",
    icon: Clock,
    variant: "secondary" as const,
    className: "",
  },
  running: {
    label: "生成中",
    icon: Loader2,
    variant: "default" as const,
    className: "animate-spin",
  },
  completed: {
    label: "完了",
    icon: CheckCircle2,
    variant: "outline" as const,
    className: "text-green-600",
  },
  cancelled: {
    label: "キャンセル",
    icon: XCircle,
    variant: "outline" as const,
    className: "text-muted-foreground",
  },
  failed: {
    label: "失敗",
    icon: AlertCircle,
    variant: "destructive" as const,
    className: "",
  },
};

function QueueItemRow({
  item,
  onRemove,
  onOpenDetail,
  onRunNext,
  onRequeue,
}: {
  item: QueueItem;
  onRemove: () => void;
  onOpenDetail: () => void;
  onRunNext: () => void;
  onRequeue: () => void;
}) {
  const cfg = STATUS_CONFIG[item.status];
  const Icon = cfg.icon;
  const progressPct =
    item.batchCount > 0
      ? Math.round((item.currentBatch / item.batchCount) * 100)
      : 0;
  const createdAt = new Date(item.createdAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-2.5">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.className}`} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{item.label}</p>
          <p className="text-[10px] text-muted-foreground">
            {createdAt} · {item.batchCount}枚
            {item.variableLora && (
              <>
                {" "}
                ·{" "}
                <span className="font-mono">
                  {item.variableLora.strength}str
                </span>
              </>
            )}
          </p>
        </div>
        <Badge variant={cfg.variant} className="shrink-0 text-[10px]">
          {cfg.label}
        </Badge>
        {item.status === "pending" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onRunNext}
            title="このジョブを先に実行する"
            aria-label="このジョブを先に実行する"
          >
            <PlayCircle className="h-3 w-3" />
          </Button>
        )}
        {(item.status === "completed" || item.status === "cancelled") && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onRequeue}
            title="同じ内容で待機列に再度追加する（ランダム要素は再抽選される）"
            aria-label="同じ内容で待機列に再度追加する"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onOpenDetail}
          title={item.status === "pending" ? "内容を編集" : "内容を確認"}
          aria-label={item.status === "pending" ? "内容を編集" : "内容を確認"}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        {item.status !== "running" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onRemove}
            aria-label="削除"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {(item.status === "running" || item.status === "completed") && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>
              {item.currentBatch}/{item.batchCount}枚完了
            </span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1" />
        </div>
      )}
    </div>
  );
}

export default function QueueManager({
  queue,
  queueRunning,
  onRemove,
  onCancelAllPending,
  onClearLog,
  onStart,
  onPause,
  onEdit,
  onRunNext,
  onRequeue,
}: QueueManagerProps) {
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const detailItem = queue.find((i) => i.id === detailItemId) ?? null;

  const pending = queue.filter((i) => i.status === "pending").length;
  const running = queue.filter((i) => i.status === "running").length;
  const done = queue.filter(
    (i) =>
      i.status === "completed" ||
      i.status === "cancelled" ||
      i.status === "failed",
  ).length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex flex-1 gap-2 text-xs text-muted-foreground">
          {running > 0 && (
            <span className="text-blue-600">{running}件生成中</span>
          )}
          {pending > 0 && <span>{pending}件待機</span>}
          {done > 0 && <span>{done}件完了</span>}
          {queue.length === 0 && <span>キューは空です</span>}
        </div>
        <div className="flex shrink-0 gap-1">
          {queueRunning ? (
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={onPause}
              title="キューの処理を一時停止（実行中のジョブは完了まで続行）"
            >
              <Pause className="h-3 w-3" />
              一時停止
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={onStart}
              disabled={pending === 0}
              title="待機中のジョブの処理を開始"
            >
              <Play className="h-3 w-3" />
              開始
            </Button>
          )}
          {pending > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px] text-destructive hover:text-destructive"
              onClick={onCancelAllPending}
              title="待機中のアイテムをすべてキャンセル"
            >
              <StopCircle className="h-3 w-3" />
              一括中止
            </Button>
          )}
          {done > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={onClearLog}
              title="完了・キャンセル・失敗のログを削除"
            >
              <Trash2 className="h-3 w-3" />
              ログ削除
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1.5 pr-3">
          {queue.length === 0 && (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <p className="text-xs text-muted-foreground">
                「キューに追加」でジョブを追加
              </p>
            </div>
          )}
          {[...queue].reverse().map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              onRemove={() => onRemove(item.id)}
              onOpenDetail={() => setDetailItemId(item.id)}
              onRunNext={() => onRunNext(item.id)}
              onRequeue={() => onRequeue(item.id)}
            />
          ))}
        </div>
      </ScrollArea>

      <QueueItemEditDialog
        item={detailItem}
        onOpenChange={(open) => !open && setDetailItemId(null)}
        onSave={onEdit}
      />
    </div>
  );
}
