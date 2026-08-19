"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import AppHeader from "@/components/common/app-header";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Check,
  ArrowRight,
  Download,
  Info,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import type { ProcessJob } from "@/lib/process/process-jobs";
import type { RunRequest } from "@/app/api/process/run/route";
import type { FolderInfo } from "@/app/api/process/dirs/route";
import {
  MosaicConfig,
  DEFAULT_MOSAIC,
} from "@/components/common/mosaic-config";

type SysSnapshot = {
  t: number;
  cpu: number;
  gpu: number | null;
  vramPct: number | null;
  vramUsed: number | null;
  vramTotal: number | null;
  gpuName: string | null;
};

// ---- helpers ----
function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDuration(secs: number): string {
  if (!isFinite(secs) || secs <= 0) return "—";
  if (secs < 60) return `${Math.round(secs)}秒`;
  if (secs < 3600)
    return `${Math.floor(secs / 60)}分${Math.round(secs % 60)}秒`;
  return `${Math.floor(secs / 3600)}時間${Math.floor((secs % 3600) / 60)}分`;
}

function thumbUrl(relativePath: string) {
  return `/api/comfy/output/thumbnail?path=${encodeURIComponent(relativePath)}`;
}

/** automosaic.py saves output as {stem}_mosaic{ext} */
function toMosaicFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return filename + "_mosaic";
  return filename.slice(0, dot) + "_mosaic" + filename.slice(dot);
}

// ---- config defaults ----

const DEFAULT_RESIZE = {
  enabled: true,
  scalePercent: 40,
  autoTarget: true,
  targetMB: 100,
  quality: 100,
  convertFormat: "jpg" as "keep" | "png" | "jpg",
  convertQuality: 100,
};

// ---- StatPill ----
function StatPill({
  label,
  value,
  unit = "",
  colorClass,
}: {
  label: string;
  value: number | null;
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

// ---- ResourceMonitor ----
function ResourceMonitor({ snapshots }: { snapshots: SysSnapshot[] }) {
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

// ---- FolderPickerModal ----
function FolderPickerModal({
  open,
  folders,
  selected,
  loading,
  onRefresh,
  onSelect,
  onClose,
}: {
  open: boolean;
  folders: FolderInfo[];
  selected: string;
  loading: boolean;
  onRefresh: () => void;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="h-4 w-4" />
            処理対象フォルダを選択
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 gap-1 text-[11px]"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
              />
              更新
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[75vh] pr-3">
          {folders.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              {loading ? "読み込み中..." : "フォルダが見つかりません"}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {folders.map((folder) => {
                const isSelected = selected === folder.name;
                return (
                  <button
                    key={folder.name}
                    onClick={() => {
                      onSelect(folder.name);
                      onClose();
                    }}
                    className={`group relative overflow-hidden rounded-xl border text-left transition-all hover:border-primary/60 hover:shadow-lg ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border bg-card/30"
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/30">
                      {folder.firstImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrl(folder.firstImage)}
                          alt={folder.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary shadow">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="px-3 py-2">
                      <p className="truncate font-mono text-[11px] font-medium leading-tight">
                        {folder.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {folder.count} 枚
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ---- ConfigSection ----
function ConfigSection({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card/30 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          id={`toggle-${title}`}
        />
        <Label
          htmlFor={`toggle-${title}`}
          className="cursor-pointer text-sm font-semibold"
        >
          {title}
        </Label>
      </div>
      {enabled && <div className="space-y-3">{children}</div>}
    </div>
  );
}

/** Compute scale% so total output ≈ targetMB (pixel-area estimate). */
function calcAutoScale(currentBytes: number, targetMB: number): number {
  if (currentBytes <= 0) return 100;
  const ratio = (targetMB * 1024 * 1024) / currentBytes;
  return Math.min(100, Math.max(10, Math.round(Math.sqrt(ratio) * 100)));
}

/**
 * JPEG変換時の追加圧縮率(PNG相当を1とした倍率)のおおまかな目安。
 * 実際のファイルサイズは画像内容（線画/写真調、色数など）に強く依存するため、
 * あくまで大まかな傾向を示す経験則。PNG変換/元形式のままの場合は倍率を掛けない。
 */
function estimateFormatMultiplier(
  format: "keep" | "png" | "jpg",
  quality: number,
): number {
  if (format === "jpg") return 0.15 + (quality / 100) * 0.35;
  return 1;
}

// ---- ResizeConfig ----
function ResizeConfig({
  config,
  onChange,
  estimate,
}: {
  config: typeof DEFAULT_RESIZE;
  onChange: (c: typeof DEFAULT_RESIZE) => void;
  estimate: {
    count: number;
    currentBytes: number;
    estimatedBytes: number;
  } | null;
}) {
  const set = <K extends keyof typeof DEFAULT_RESIZE>(
    k: K,
    v: (typeof DEFAULT_RESIZE)[K],
  ) => onChange({ ...config, [k]: v });

  const autoScale =
    config.autoTarget && estimate
      ? calcAutoScale(estimate.currentBytes, config.targetMB)
      : null;

  return (
    <>
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">
            解像度スケール
          </Label>
          <button
            onClick={() => set("autoTarget", !config.autoTarget)}
            className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              config.autoTarget
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            合計サイズ自動
          </button>
        </div>

        {config.autoTarget ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">
                目標合計
              </Label>
              <Input
                type="number"
                min={1}
                max={9999}
                value={config.targetMB}
                onChange={(e) => set("targetMB", Number(e.target.value) || 200)}
                className="h-7 w-24 text-right text-xs"
              />
              <span className="text-xs text-muted-foreground">MB</span>
              {autoScale !== null && (
                <span className="ml-auto font-mono text-sm font-bold">
                  → {autoScale}%
                </span>
              )}
            </div>
            {!estimate && (
              <p className="text-[11px] text-muted-foreground">
                フォルダを選択するとスケールを自動計算します
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Slider
                min={10}
                max={100}
                step={5}
                value={[config.scalePercent]}
                onValueChange={([v]) => set("scalePercent", v)}
                className="flex-1"
              />
              <span className="w-10 text-right font-mono text-sm font-bold">
                {config.scalePercent}%
              </span>
            </div>
          </>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            品質 (JPEG / WebP / AVIF)
          </Label>
          <span className="font-mono text-xs">{config.quality}</span>
        </div>
        <Slider
          min={1}
          max={100}
          step={1}
          value={[config.quality]}
          onValueChange={([v]) => set("quality", v)}
        />
      </div>

      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">
          画像形式の変換
        </Label>
        <div className="flex gap-1">
          {(["keep", "png", "jpg"] as const).map((f) => (
            <button
              key={f}
              onClick={() => set("convertFormat", f)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                config.convertFormat === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {f === "keep" ? "元の形式のまま" : f.toUpperCase()}
            </button>
          ))}
        </div>
        {config.convertFormat === "jpg" && (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">JPEG品質</Label>
              <span className="font-mono text-xs">{config.convertQuality}</span>
            </div>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[config.convertQuality]}
              onValueChange={([v]) => set("convertQuality", v)}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ---- JobProgress ----
function JobProgress({
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

// ---- BeforeAfterGallery ----
function BeforeAfterGallery({
  folder,
  processedImages,
  hasMosaic,
  hasResize,
  cacheBust,
}: {
  folder: string;
  processedImages: string[];
  hasMosaic: boolean;
  hasResize: boolean;
  cacheBust: number;
}) {
  if (processedImages.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        処理結果 ({processedImages.length}枚)
      </p>
      <div className="space-y-2">
        {processedImages.map((filename) => {
          const beforePath = `${folder}/${filename}`;
          const afterPath = hasMosaic
            ? `${folder}/mosaic/${toMosaicFilename(filename)}`
            : hasResize
              ? `${folder}/resized/${filename}`
              : null;
          return (
            <div
              key={filename}
              className="flex items-center gap-2 rounded-lg border bg-card/20 p-2"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-mono text-[10px] text-muted-foreground mb-1.5 px-0.5">
                  {filename}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="mb-1 text-[10px] text-muted-foreground">
                      処理前
                    </p>

                    <img
                      src={thumbUrl(beforePath)}
                      alt={`before ${filename}`}
                      className="w-full rounded object-cover aspect-[4/3]"
                      loading="lazy"
                    />
                  </div>
                  {afterPath && (
                    <>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />

                      <div className="flex-1 min-w-0">
                        <p className="mb-1 text-[10px] text-muted-foreground">
                          処理後
                        </p>

                        <img
                          src={`${thumbUrl(afterPath)}&v=${cacheBust}`}
                          alt={`after ${filename}`}
                          className="w-full rounded object-cover aspect-[4/3]"
                          loading="lazy"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- main page ----
export default function ProcessPage() {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [loadingDirs, setLoadingDirs] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [mosaicConfig, setMosaicConfig] = useState(DEFAULT_MOSAIC);
  const [resizeConfig, setResizeConfig] = useState(DEFAULT_RESIZE);

  const [estimate, setEstimate] = useState<{
    count: number;
    currentBytes: number;
    estimatedBytes: number;
  } | null>(null);

  const effectiveScale = useMemo(
    () =>
      resizeConfig.autoTarget && estimate
        ? calcAutoScale(estimate.currentBytes, resizeConfig.targetMB)
        : resizeConfig.scalePercent,
    [
      resizeConfig.autoTarget,
      resizeConfig.targetMB,
      resizeConfig.scalePercent,
      estimate,
    ],
  );

  // 圧縮(画像形式変換)も踏まえた出力サイズの目安。resize無効時はnull
  const estimatedFinalBytes = useMemo(() => {
    if (!resizeConfig.enabled || !estimate) return null;
    const formatMultiplier = estimateFormatMultiplier(
      resizeConfig.convertFormat,
      resizeConfig.convertQuality,
    );
    return (
      estimate.currentBytes * (effectiveScale / 100) ** 2 * formatMultiplier
    );
  }, [
    resizeConfig.enabled,
    resizeConfig.convertFormat,
    resizeConfig.convertQuality,
    estimate,
    effectiveScale,
  ]);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ProcessJob | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Local sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    saved: number;
    skipped: number;
    total: number;
    localPath: string;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sysinfo polling
  const [snapshots, setSnapshots] = useState<SysSnapshot[]>([]);
  const sysinfoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDirs = useCallback(async () => {
    setLoadingDirs(true);
    try {
      const url = localMode
        ? "/api/process/dirs?local=true"
        : "/api/process/dirs";
      const res = await fetch(url);
      const data = await res.json();
      setFolders(data.dirs ?? []);
    } finally {
      setLoadingDirs(false);
    }
  }, [localMode]);

  useEffect(() => {
    loadDirs();
  }, [loadDirs]);

  useEffect(() => {
    setSelectedFolder("");
    setEstimate(null);
  }, [localMode]);

  // Estimate size when folder or scale changes.
  // scalePercentはスライダーのドラッグ中に連続更新されるため、デバウンスを挟んで
  // ドラッグ中の連続APIコールを防ぐ(止まってから300ms後に1回だけ呼ぶ)。
  useEffect(() => {
    if (!selectedFolder) {
      setEstimate(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/process/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: selectedFolder,
          scalePercent: resizeConfig.scalePercent,
          local: localMode,
        }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then(setEstimate)
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedFolder, resizeConfig.scalePercent, localMode]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/process/status/${jobId}`);
        if (!res.ok) return;
        const data: ProcessJob = await res.json();
        if (!data.id) return; // guard against error response shape
        setJob((prev) => ({
          ...prev,
          ...data,
          log: data.log ?? prev?.log ?? [],
          processedImages: data.processedImages ?? prev?.processedImages ?? [],
        }));
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch {}
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  // Sysinfo polling — always on, 2 s interval
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
    sysinfoRef.current = setInterval(poll, 2000);
    return () => {
      if (sysinfoRef.current) clearInterval(sysinfoRef.current);
    };
  }, []);

  const failJob = (message: string) => {
    setJob({
      id: "run-error",
      status: "failed",
      total: 0,
      current: 0,
      log: [message],
      processedImages: [],
      results: [],
      startedAt: Date.now(),
    });
  };

  const handleRun = async () => {
    if (!selectedFolder || (!mosaicConfig.enabled && !resizeConfig.enabled))
      return;
    setSubmitting(true);
    setJob(null);
    setJobId(null);
    setSyncResult(null);
    setSyncError(null);
    setLogOpen(true);
    try {
      if (localMode) {
        setUploading(true);
        try {
          const uploadRes = await fetch("/api/process/upload-to-remote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: selectedFolder }),
          });
          if (!uploadRes.ok) {
            failJob("リモートへのアップロードに失敗しました");
            return;
          }
        } catch (e) {
          failJob(
            `リモートへのアップロードに失敗しました: ${e instanceof Error ? e.message : String(e)}`,
          );
          return;
        } finally {
          setUploading(false);
        }
      }
      const body: RunRequest = {
        folder: selectedFolder,
        mosaic: mosaicConfig,
        resize: { ...resizeConfig, scalePercent: effectiveScale },
      };
      let data: { jobId?: string; error?: string };
      try {
        const res = await fetch("/api/process/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        data = await res.json();
      } catch (e) {
        failJob(`実行リクエストに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
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
      } else {
        failJob(data.error ?? "実行に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async () => {
    if (!selectedFolder || !jobId?.startsWith("remote:")) return;
    const sub = mosaicConfig.enabled ? "mosaic" : "resized";
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/process/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, sub }),
      });
      const data = await res.json();
      if (res.ok) setSyncResult(data);
      else setSyncError(data.error ?? "ローカルフォルダへの保存に失敗しました");
    } catch (e) {
      setSyncError(`ローカルフォルダへの保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const isRunning = job?.status === "running" || job?.status === "pending";
  const selectedFolderInfo = folders.find((f) => f.name === selectedFolder);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppHeader active="process" />

      <div className="flex min-h-0 flex-1 gap-0">
        <div className="flex w-160 shrink-0 flex-col border-r">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <Label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    処理対象フォルダ
                  </Label>
                  <div className="ml-auto flex gap-0.5 rounded border p-0.5">
                    <button
                      onClick={() => setLocalMode(false)}
                      className={`rounded px-2 py-0.5 text-[11px] transition-colors ${!localMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      リモート
                    </button>
                    <button
                      onClick={() => setLocalMode(true)}
                      className={`rounded px-2 py-0.5 text-[11px] transition-colors ${localMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      ローカル
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    loadDirs();
                    setPickerOpen(true);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/50 ${
                    selectedFolder
                      ? "border-border bg-card/30"
                      : "border-dashed border-border"
                  }`}
                >
                  {selectedFolderInfo?.firstImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrl(selectedFolderInfo.firstImage)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted/50">
                      <FolderOpen className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {selectedFolder ? (
                      <>
                        <p className="truncate font-mono text-xs font-medium">
                          {selectedFolder}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {selectedFolderInfo?.count ?? "?"} 枚
                          {estimate
                            ? ` · ${fmtBytes(estimate.currentBytes)}`
                            : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        クリックして選択...
                      </p>
                    )}
                  </div>
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>

              <Separator />

              <ConfigSection
                title="リサイズ / 圧縮"
                enabled={resizeConfig.enabled}
                onToggle={(v) => setResizeConfig((c) => ({ ...c, enabled: v }))}
              >
                <ResizeConfig
                  config={resizeConfig}
                  onChange={setResizeConfig}
                  estimate={resizeConfig.enabled ? estimate : null}
                />
              </ConfigSection>

              <ConfigSection
                title="自動モザイク"
                enabled={mosaicConfig.enabled}
                onToggle={(v) => setMosaicConfig((c) => ({ ...c, enabled: v }))}
              >
                <MosaicConfig
                  config={mosaicConfig}
                  onChange={setMosaicConfig}
                />
              </ConfigSection>

              {resizeConfig.enabled && mosaicConfig.enabled && (
                <p className="text-[11px] text-muted-foreground rounded border border-border bg-muted/30 px-2 py-1.5">
                  リサイズ → モザイクの順で実行（先に縮小して I/O
                  を削減）。出力先:{" "}
                  <span className="font-mono">
                    {selectedFolder || "…"}/mosaic/
                  </span>
                </p>
              )}
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t p-3">
            {estimate && estimatedFinalBytes !== null && (
              <Alert className="mb-2">
                <Info />
                <AlertTitle>出力サイズの目安</AlertTitle>
                <AlertDescription>
                  現在 {fmtBytes(estimate.currentBytes)} ({estimate.count}枚) →
                  約 {fmtBytes(estimatedFinalBytes)}
                  {resizeConfig.convertFormat === "jpg" && "（JPEG変換込み）"}
                </AlertDescription>
              </Alert>
            )}
            <Button
              className="w-full gap-2"
              disabled={
                !selectedFolder ||
                (!mosaicConfig.enabled && !resizeConfig.enabled) ||
                isRunning ||
                submitting
              }
              onClick={handleRun}
            >
              {isRunning || submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {uploading
                ? "アップロード中..."
                : isRunning || submitting
                  ? "処理中..."
                  : "処理を開始"}
            </Button>
            {!mosaicConfig.enabled && !resizeConfig.enabled && (
              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                モザイクかリサイズを有効にしてください
              </p>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <ResourceMonitor snapshots={snapshots} />
          <ScrollArea className="flex-1 p-4">
            {!job ? (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    処理を開始するとここに進捗が表示されます
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    出力先:{" "}
                    <span className="font-mono">
                      {selectedFolder || "…"}/mosaic/
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <>
                <JobProgress
                  job={job}
                  logOpen={logOpen}
                  onToggleLog={() => setLogOpen((v) => !v)}
                />

                {job.status === "completed" && (
                  <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 space-y-2">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      処理が完了しました
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      出力先:{" "}
                      <span className="font-mono">
                        {selectedFolder}/
                        {mosaicConfig.enabled ? "mosaic" : "resized"}/
                      </span>
                    </p>
                    {jobId?.startsWith("remote:") && !syncResult && (
                      <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="inline-flex items-center gap-1.5 rounded-md border border-green-600/40 bg-green-600/10 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-600/20 dark:text-green-300 transition-colors disabled:opacity-50"
                      >
                        {syncing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        {syncing ? "保存中..." : "ローカルフォルダに保存"}
                      </button>
                    )}
                    {syncError && (
                      <p className="rounded border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                        {syncError}
                      </p>
                    )}
                    {syncResult && (
                      <div className="rounded border border-border bg-muted/30 px-2.5 py-2 text-[11px] space-y-0.5">
                        <p className="font-medium text-foreground">
                          保存完了: {syncResult.saved} 枚
                          {syncResult.skipped > 0 && (
                            <span className="ml-1 text-muted-foreground">
                              (スキップ {syncResult.skipped} 枚)
                            </span>
                          )}
                        </p>
                        <p className="font-mono text-muted-foreground break-all">
                          {syncResult.localPath}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <BeforeAfterGallery
                  folder={selectedFolder}
                  processedImages={job.processedImages}
                  hasMosaic={mosaicConfig.enabled}
                  hasResize={resizeConfig.enabled}
                  cacheBust={job.startedAt}
                />
              </>
            )}
          </ScrollArea>
        </div>
      </div>

      <FolderPickerModal
        open={pickerOpen}
        folders={folders}
        selected={selectedFolder}
        loading={loadingDirs}
        onRefresh={loadDirs}
        onSelect={setSelectedFolder}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
