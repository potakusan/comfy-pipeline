"use client";
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

export default function GalleryPoseSummary({
  stats,
  activePose,
  onSelectPose,
}: {
  stats: PoseStat[];
  activePose: string | null;
  onSelectPose: (pose: string) => void;
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
        <button
          key={s.pose}
          onClick={() => onSelectPose(s.pose)}
          className={`flex items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors ${
            s.pose === activePose
              ? "bg-primary/10 text-foreground"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          <span className="min-w-0 flex-1 truncate font-mono">{s.pose}</span>
          <span
            className={`shrink-0 tabular-nums ${s.released > 0 ? "text-primary font-medium" : ""}`}
          >
            {s.released}/{s.total}
          </span>
        </button>
      ))}
    </div>
  );
}
