"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPoseGroup } from "@/lib/gallery";
import type { GalleryImageEntry } from "@/lib/gallery";

interface PoseStat {
  pose: string;
  total: number;
  released: number;
}

export function computePoseStats(images: GalleryImageEntry[]): PoseStat[] {
  const map = new Map<string, PoseStat>();
  for (const img of images) {
    const pose = getPoseGroup(img.filename);
    const stat = map.get(pose) ?? { pose, total: 0, released: 0 };
    stat.total++;
    if (img.releasePath) stat.released++;
    map.set(pose, stat);
  }
  return Array.from(map.values());
}

/** そのポーズ(プリセット)のランダム部分を引き直して、あと n 枚生成する */
function GenerateMoreButton({
  pose,
  onGenerateMore,
}: {
  pose: string;
  onGenerateMore: (pose: string, count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(4);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="このポーズをあとn枚生成(ランダム部分は引き直し)"
        >
          <Plus className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2 p-3">
        <p className="truncate font-mono text-[10px] text-muted-foreground">{pose}</p>
        <label className="flex items-center gap-2 text-xs">
          <span className="font-semibold">追加枚数</span>
          <Input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-7 w-20 text-xs"
          />
        </label>
        <p className="text-[10px] text-muted-foreground">
          seed・ランダム抽選の行・ランダム変数を引き直し、同じ構成でキューに追加します。
        </p>
        <Button
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => {
            setOpen(false);
            onGenerateMore(pose, count);
          }}
        >
          キューに追加
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default function GalleryPoseSummary({
  stats,
  activePose,
  onSelectPose,
  onGenerateMore,
}: {
  stats: PoseStat[];
  activePose: string | null;
  onSelectPose: (pose: string) => void;
  onGenerateMore?: (pose: string, count: number) => void;
}) {
  if (stats.length === 0) {
    return (
      <p className="p-3 text-center text-xs text-muted-foreground">
        画像がありません
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
      {stats.map((s) => (
        <div
          key={s.pose}
          className={`flex items-center gap-1 rounded pr-1 text-[11px] transition-colors ${
            s.pose === activePose
              ? "bg-primary/10 text-foreground"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          <button
            onClick={() => onSelectPose(s.pose)}
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left"
          >
            <span className="min-w-0 flex-1 truncate font-mono">{s.pose}</span>
            <span
              className={`shrink-0 tabular-nums ${s.released > 0 ? "text-primary font-medium" : ""}`}
            >
              {s.released}/{s.total}
            </span>
          </button>
          {onGenerateMore && <GenerateMoreButton pose={s.pose} onGenerateMore={onGenerateMore} />}
        </div>
      ))}
    </div>
  );
}
