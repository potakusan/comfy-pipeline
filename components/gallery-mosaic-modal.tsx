"use client";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2, Play, ChevronDown, ChevronUp } from "lucide-react";
import {
  MosaicConfig,
  DEFAULT_MOSAIC,
  type MosaicConfigValue,
} from "@/components/mosaic-config";
import type { ProcessJob, MosaicImageResult } from "@/lib/process-jobs";
import { apiFetch } from "@/lib/api-client";

const DEFAULT_GALLERY_RESIZE = { scalePercent: 40, quality: 100 };
type GalleryResizeValue = typeof DEFAULT_GALLERY_RESIZE;

function thumbUrl(relPath: string) {
  return `/api/comfy/output/thumbnail?path=${encodeURIComponent(relPath)}`;
}
function imageUrl(relPath: string) {
  return `/api/comfy/output/image?path=${encodeURIComponent(relPath)}`;
}

function ResultThumb({ label, path }: { label: string; path: string | null }) {
  if (!path) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-dashed text-[9px] text-muted-foreground">
        なし
      </div>
    );
  }
  return (
    <HoverCard openDelay={150} closeDelay={0}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="block h-14 w-14 shrink-0 overflow-hidden rounded border border-border"
        >
          <img
            src={thumbUrl(path)}
            alt={label}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-auto max-w-xs p-1.5">
        <img
          src={imageUrl(path)}
          alt={label}
          className="max-h-80 max-w-full rounded object-contain"
        />
        <p className="mt-1 truncate px-0.5 text-[10px] text-muted-foreground">
          {label}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

function ResultRow({
  folder,
  result,
}: {
  folder: string;
  result: MosaicImageResult;
}) {
  const beforePath = `${folder}/${result.filename}`;
  return (
    <div className="flex items-center gap-2 rounded border border-border/60 bg-card/30 p-1.5">
      <ResultThumb label="元画像" path={beforePath} />
      <ResultThumb label="処理後" path={result.outputPath} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[10px]">{result.filename}</p>
        <Badge
          variant={result.regionCount > 0 ? "default" : "outline"}
          className="mt-0.5 text-[9px]"
        >
          {result.regionCount > 0 ? `${result.regionCount}箇所` : "対象なし"}
        </Badge>
      </div>
    </div>
  );
}

export default function GalleryMosaicModal({
  open,
  onClose,
  folder,
}: {
  open: boolean;
  onClose: () => void;
  folder: string;
}) {
  const [config, setConfig] = useState<MosaicConfigValue>(DEFAULT_MOSAIC);
  const [resizeConfig, setResizeConfig] = useState<GalleryResizeValue>(
    DEFAULT_GALLERY_RESIZE,
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ProcessJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setJobId(null);
      setJob(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch<ProcessJob>(`/api/process/status/${jobId}`);
        if (!data.id) return;
        setJob(data);
        if (data.status === "completed" || data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {}
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  const handleRun = async () => {
    setSubmitting(true);
    setJob(null);
    setJobId(null);
    try {
      const res = await fetch("/api/gallery/mosaic/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, mosaic: config, resize: resizeConfig }),
      });
      const data = await res.json();
      if (data.jobId) {
        setJobId(data.jobId);
        setJob({
          id: data.jobId,
          status: "pending",
          total: 0,
          current: 0,
          log: [],
          processedImages: [],
          results: [],
          startedAt: Date.now(),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const running = job?.status === "pending" || job?.status === "running";
  const results = job?.results ?? [];
  const processed = results.filter((r) => r.regionCount > 0);
  const noTarget = results.filter((r) => r.regionCount === 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[88vh] w-full! max-w-3xl! flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            モザイク処理 — {folder}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="rounded-lg border bg-card/30 p-3">
            <MosaicConfig config={config} onChange={setConfig} />
          </div>

          <div className="space-y-3 rounded-lg border bg-card/30 p-3">
            <p className="text-sm font-semibold">画像縮小</p>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  縮小率（モザイク前に適用）
                </Label>
                <span className="font-mono text-sm font-bold">
                  {resizeConfig.scalePercent}%
                </span>
              </div>
              <Slider
                min={10}
                max={100}
                step={5}
                value={[resizeConfig.scalePercent]}
                onValueChange={([v]) =>
                  setResizeConfig((c) => ({ ...c, scalePercent: v }))
                }
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  品質 (JPEG / WebP / AVIF)
                </Label>
                <span className="font-mono text-xs">
                  {resizeConfig.quality}
                </span>
              </div>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[resizeConfig.quality]}
                onValueChange={([v]) =>
                  setResizeConfig((c) => ({ ...c, quality: v }))
                }
              />
            </div>
          </div>

          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={handleRun}
            disabled={submitting || running}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {running ? "処理中..." : "実行"}
          </Button>

          {job && (
            <div className="rounded-lg border bg-card/30 p-3 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span>
                  {job.status === "completed"
                    ? "完了"
                    : job.status === "failed"
                      ? "失敗"
                      : "処理中"}
                </span>
                <span className="font-mono tabular-nums">
                  {job.current} / {job.total}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${job.total > 0 ? Math.min(100, (job.current / job.total) * 100) : 0}%`,
                  }}
                />
              </div>
              {job.error && (
                <p className="mt-1 text-destructive">{job.error}</p>
              )}
              <button
                type="button"
                className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setLogOpen((v) => !v)}
              >
                {logOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                ログ ({job.log.length}行)
              </button>
              {logOpen && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded bg-muted/30 p-2 font-mono text-[10px] whitespace-pre-wrap">
                  {job.log.join("\n")}
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  モザイク処理済み ({processed.length})
                </p>
                <div className="flex flex-col gap-1.5">
                  {processed.map((r) => (
                    <ResultRow key={r.filename} folder={folder} result={r} />
                  ))}
                  {processed.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">なし</p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  対象が見つからなかった画像 ({noTarget.length})
                </p>
                <div className="flex flex-col gap-1.5">
                  {noTarget.map((r) => (
                    <ResultRow key={r.filename} folder={folder} result={r} />
                  ))}
                  {noTarget.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">なし</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
