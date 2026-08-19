"use client";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { usePipeline, type PromptPreviewPos } from "@/hooks/pipeline/use-pipeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Kbd } from "@/components/ui/kbd";
import LoraPanel from "@/components/pipeline/lora/lora-panel";
import PromptBuilder from "@/components/pipeline/prompt/prompt-builder";
import SamplerSettings from "@/components/pipeline/sampler-settings";
import TagSettings from "@/components/pipeline/prompt/tag-settings";
import CouplePanel from "@/components/pipeline/couple/couple-panel";
import { useCouple } from "@/hooks/pipeline/use-couple";
import { buildCouplePrompt, applySelectedPresets } from "@/lib/comfy/couple";
import { assemblePositivePrompt } from "@/lib/comfy";
import type { LoraEntry, Preset, QueueItem, GalleryImage } from "@/lib/comfy";
import PreviewPanel from "@/components/pipeline/preview-panel";
import QueueManager from "@/components/pipeline/queue/queue-manager";
import GalleryPanel from "@/components/pipeline/gallery-panel";
import BatchQueueDialog from "@/components/pipeline/queue/batch-queue-dialog";
import QuickAddToBatch from "@/components/pipeline/queue/quick-add-to-batch";
import AppHeader from "@/components/common/app-header";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Download,
  Upload,
  Shuffle,
  Eye,
  Layers,
  MessageSquare,
  Settings2,
  Tag,
  Users,
  Pin,
  User,
  Hash,
  Move,
  MapPin,
  Star,
  AlignLeft,
  MinusCircle,
  GripHorizontal,
  RefreshCw,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// GPU monitor types & component
// ---------------------------------------------------------------------------

type SysSnapshot = {
  t: number;
  cpu: number;
  gpu: number | null;
  vramPct: number | null;
  vramUsed: number | null;
  vramTotal: number | null;
  gpuName: string | null;
};

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

function GpuMonitor({
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
                    <RechartsTooltip
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

// ---------------------------------------------------------------------------
// Left icon nav
// ---------------------------------------------------------------------------

type LeftSectionId =
  | "lora"
  | "prompt"
  | "sampler"
  | "variation"
  | "tagdb"
  | "couple-top"
  | "p-fixed"
  | "p-physical"
  | "p-count"
  | "p-pose"
  | "p-scene"
  | "p-other"
  | "p-add"
  | "p-neg";

type NavItem = {
  id: LeftSectionId;
  icon: React.ElementType;
  label: string;
  sub?: boolean;
};

const NORMAL_NAV: NavItem[] = [
  { id: "lora", icon: Layers, label: "LoRA設定" },
  { id: "prompt", icon: MessageSquare, label: "プロンプト" },
  { id: "p-fixed", icon: Pin, label: "固定タグ", sub: true },
  { id: "p-physical", icon: User, label: "身体的特徴", sub: true },
  { id: "p-count", icon: Hash, label: "人数", sub: true },
  { id: "p-pose", icon: Move, label: "ポーズ", sub: true },
  { id: "p-scene", icon: MapPin, label: "シーン", sub: true },
  { id: "p-other", icon: Star, label: "その他", sub: true },
  { id: "p-add", icon: AlignLeft, label: "追加プロンプト", sub: true },
  { id: "p-neg", icon: MinusCircle, label: "ネガティブ", sub: true },
  { id: "sampler", icon: Settings2, label: "サンプラー設定" },
  { id: "variation", icon: Shuffle, label: "ランダム構図" },
  { id: "tagdb", icon: Tag, label: "タグDB設定" },
];

const COUPLE_NAV: NavItem[] = [
  { id: "couple-top", icon: Users, label: "マルチキャラ設定" },
];

function LeftIconNav({
  activeTab,
  onScrollTo,
}: {
  activeTab: "normal" | "couple";
  onScrollTo: (id: LeftSectionId) => void;
}) {
  const items = activeTab === "normal" ? NORMAL_NAV : COUPLE_NAV;
  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex w-10 shrink-0 flex-col border-r bg-background py-1">
        {items.map(({ id, icon: Icon, label, sub }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onScrollTo(id)}
                className={`flex w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground ${
                  sub ? "h-7 pl-1.5" : "h-10"
                }`}
              >
                <Icon className={sub ? "h-3 w-3" : "h-4 w-4"} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Section accordion
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="py-0.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground hover:text-foreground/80"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground ${open ? "" : "-rotate-90"}`}
        />
        <span className="flex-1">{title}</span>
        {badge && (
          <Badge variant="secondary" className="text-[10px]">
            {badge}
          </Badge>
        )}
      </button>
      {open && <div className="pb-3">{children}</div>}
      <Separator />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ETA overlay
// ---------------------------------------------------------------------------

function formatEta(ms: number): string {
  if (ms <= 0) return "0秒";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}秒`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return s > 0 ? `${m}分${s}秒` : `${m}分`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}時間${rm}分` : `${h}時間`;
}

function FloatingEtaOverlay({
  queue,
  isProcessing,
  currentJobImages,
  pos,
  onPosChange,
}: {
  queue: QueueItem[];
  isProcessing: boolean;
  currentJobImages: GalleryImage[];
  pos: PromptPreviewPos;
  onPosChange: (p: PromptPreviewPos) => void;
}) {
  const [position, setPosition] = useState({ x: pos.x, y: pos.y });
  const [collapsed, setCollapsed] = useState(pos.collapsed);

  // use-pipeline.tsのlocalStorage読み込み完了(pos.xが-1から実値へ変わる)に合わせて
  // 内部stateを同期する。他のフローティングウィンドウ(FloatingPromptPreview)と同じ方式
  // (位置をuse-pipeline.tsのexportData/importDataの管理下に置くため、ここではローカル
  // storageを直接読み書きしない)。
  const posLoadedRef = useRef(false);
  useEffect(() => {
    if (posLoadedRef.current) return;
    if (pos.x === -1 || pos.y === -1) {
      const x = Math.max(10, window.innerWidth - 220);
      const y = 10;
      posLoadedRef.current = true;
      setPosition({ x, y });
      onPosChange({ x, y, collapsed: false });
    } else {
      posLoadedRef.current = true;
      setPosition({ x: pos.x, y: pos.y });
      setCollapsed(pos.collapsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.x, pos.y]);

  const savePos = useCallback(
    (p: { x: number; y: number }, col: boolean) => {
      onPosChange({ ...p, collapsed: col });
    },
    [onPosChange],
  );

  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    didDrag.current = false;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    didDrag.current = true;
    const x = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 50));
    const y = Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 40));
    setPosition({ x, y });
  };

  const handlePointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    savePos(position, collapsed);
  };

  const handleTitleClick = () => {
    if (didDrag.current) { didDrag.current = false; return; }
    const nc = !collapsed;
    setCollapsed(nc);
    savePos(position, nc);
  };

  // Timing tracking
  const durationsRef = useRef<number[]>([]);
  const [avgMs, setAvgMs] = useState<number | null>(null);
  const lastEventRef = useRef<number>(0);
  const prevImgLenRef = useRef(0);
  const prevProcessingRef = useRef(false);

  useEffect(() => {
    if (isProcessing && !prevProcessingRef.current) {
      lastEventRef.current = Date.now();
      prevImgLenRef.current = 0;
    }
    prevProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    const prevLen = prevImgLenRef.current;
    const newLen = currentJobImages.length;

    if (newLen === 0 && prevLen > 0) {
      lastEventRef.current = Date.now();
      prevImgLenRef.current = 0;
      return;
    }

    if (newLen > prevLen && lastEventRef.current > 0) {
      const delta = newLen - prevLen;
      const elapsed = Date.now() - lastEventRef.current;
      const perImg = elapsed / delta;
      if (perImg >= 500) {
        const updated = [...durationsRef.current, perImg].slice(-10);
        durationsRef.current = updated;
        setAvgMs(updated.reduce((a, b) => a + b, 0) / updated.length);
      }
      lastEventRef.current = Date.now();
    }

    prevImgLenRef.current = newLen;
  }, [currentJobImages.length]);

  const runningItem = queue.find((i) => i.status === "running");
  const remainingCurrent = runningItem ? runningItem.batchCount - runningItem.currentBatch : 0;
  const pendingTotal = queue
    .filter((i) => i.status === "pending")
    .reduce((s, i) => s + i.batchCount, 0);
  const totalRemaining = remainingCurrent + pendingTotal;

  // Live tick for countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isProcessing || avgMs === null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isProcessing, avgMs]);

  const etaMs =
    avgMs !== null && totalRemaining > 0
      ? Math.max(
          0,
          avgMs * totalRemaining -
            (lastEventRef.current > 0 ? Date.now() - lastEventRef.current : 0),
        )
      : null;

  const displayX = position.x === -1 ? 10 : position.x;
  const displayY = position.y === -1 ? 10 : position.y;

  return (
    <div
      className="fixed z-50 w-52 overflow-hidden rounded-lg border bg-background shadow-lg"
      style={{ left: displayX, top: displayY }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="flex cursor-grab items-center gap-2 px-3 py-1.5 hover:bg-muted/30 active:cursor-grabbing select-none"
        onPointerDown={handleTitlePointerDown}
        onClick={handleTitleClick}
      >
        <GripHorizontal className="h-3 w-3 shrink-0 text-muted-foreground" />
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          ETA
        </span>
        {isProcessing && (
          <Badge variant="default" className="text-[9px]">生成中</Badge>
        )}
        <div className="ml-auto">
          {collapsed ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-1.5 border-t px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">残り画像</span>
            <span className="font-mono text-xs font-semibold">{totalRemaining}枚</span>
          </div>

          {avgMs !== null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">平均/枚</span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatEta(avgMs)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">完了予測</span>
            <span
              className={`font-mono text-xs font-semibold ${
                isProcessing && etaMs !== null ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {!isProcessing
                ? "待機中"
                : etaMs === null
                  ? "計測中..."
                  : `約 ${formatEta(etaMs)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating draggable prompt preview window
// ---------------------------------------------------------------------------

type ResizeEdge = "e" | "s" | "se" | "sw" | "w" | null;

function FloatingPromptPreview({
  positivePrompt,
  negativePrompt,
  hasRandom,
  isLive,
  onRefresh,
  pos,
  onPosChange,
}: {
  positivePrompt: string;
  negativePrompt: string;
  hasRandom: boolean;
  isLive: boolean;
  onRefresh: () => void;
  pos: PromptPreviewPos;
  onPosChange: (p: PromptPreviewPos) => void;
}) {
  const [tab, setTab] = useState<"positive" | "negative">("positive");
  const [position, setPosition] = useState({ x: pos.x, y: pos.y });
  const [size, setSize] = useState({ w: pos.width ?? 400, h: pos.height ?? 220 });
  const [collapsed, setCollapsed] = useState(pos.collapsed);

  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizing = useRef<ResizeEdge>(null);
  const resizeStart = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

  // Sync internal state when localStorage finishes loading (pos transitions from -1 to real values)
  const posLoadedRef = useRef(false);
  useEffect(() => {
    if (posLoadedRef.current) return;
    if (pos.x === -1 || pos.y === -1) {
      // Still default — set a reasonable initial position on first client render
      const x = 10;
      const y = Math.max(10, window.innerHeight - 260);
      posLoadedRef.current = true;
      setPosition({ x, y });
      onPosChange({ x, y, collapsed: false, width: size.w, height: size.h });
    } else {
      // Real saved position has arrived — sync internal state
      posLoadedRef.current = true;
      setPosition({ x: pos.x, y: pos.y });
      setSize({ w: pos.width ?? 400, h: pos.height ?? 220 });
      setCollapsed(pos.collapsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.x, pos.y]);

  // Title bar: start drag
  const handleTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    didDrag.current = false;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  // Resize handle: start resize
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, edge: ResizeEdge) => {
    e.stopPropagation();
    resizing.current = edge;
    resizeStart.current = { mx: e.clientX, my: e.clientY, x: position.x, y: position.y, w: size.w, h: size.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  // Outer div handles both move and up
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizing.current) {
      const dx = e.clientX - resizeStart.current.mx;
      const dy = e.clientY - resizeStart.current.my;
      const edge = resizing.current;
      let { x, y, w, h } = resizeStart.current;
      if (edge === "e" || edge === "se") {
        w = Math.max(200, w + dx);
      }
      if (edge === "w" || edge === "sw") {
        const newW = Math.max(200, w - dx);
        x = x + (w - newW);
        w = newW;
      }
      if (edge === "s" || edge === "se" || edge === "sw") {
        h = Math.max(120, h + dy);
      }
      setSize({ w, h });
      setPosition({ x, y });
      return;
    }
    if (dragging.current) {
      didDrag.current = true;
      const x = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 50));
      const y = Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 40));
      setPosition({ x, y });
    }
  };

  const handlePointerUp = () => {
    if (resizing.current) {
      resizing.current = null;
      onPosChange({ ...position, collapsed, width: size.w, height: size.h });
      return;
    }
    if (dragging.current) {
      dragging.current = false;
      onPosChange({ ...position, collapsed, width: size.w, height: size.h });
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    // Suppress click when the pointer actually moved (drag operation)
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onPosChange({ ...position, collapsed: newCollapsed, width: size.w, height: size.h });
  };

  const displayX = position.x === -1 ? 10 : position.x;
  const displayY = position.y === -1 ? 100 : position.y;

  return (
    <div
      className="fixed z-50 rounded-lg border bg-background shadow-lg overflow-hidden"
      style={{ left: displayX, top: displayY, width: size.w, height: collapsed ? undefined : size.h }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Title bar — drag handle + collapse toggle */}
      <div
        className="flex cursor-grab items-center gap-2 px-3 py-1.5 hover:bg-muted/30 active:cursor-grabbing select-none"
        onPointerDown={handleTitlePointerDown}
        onClick={handleTitleClick}
      >
        <GripHorizontal className="h-3 w-3 shrink-0 text-muted-foreground" />
        <Eye className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          プロンプトプレビュー
        </span>
        {isLive && (
          <Badge variant="default" className="text-[9px]">
            生成中
          </Badge>
        )}
        {!isLive && hasRandom && (
          <Badge variant="secondary" className="text-[9px]">
            ランダム要素あり
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {!isLive && hasRandom && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              title="ランダム再抽選"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Shuffle className="h-3 w-3" />
            </span>
          )}
          {collapsed ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="flex flex-col border-t" style={{ height: size.h - 32 }}>
          <div className="flex gap-1 px-3 pt-2 pb-1.5 shrink-0">
            {(["positive", "negative"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                  tab === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {t === "positive" ? "ポジティブ" : "ネガティブ"}
              </button>
            ))}
          </div>
          <div className="mx-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded bg-muted/20 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-foreground/80 select-all">
            {(tab === "positive" ? positivePrompt : negativePrompt) || (
              <span className="text-muted-foreground">（未設定）</span>
            )}
          </div>
        </div>
      )}

      {/* Resize handles */}
      {!collapsed && (
        <>
          <div className="absolute top-6 right-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/20"
            onPointerDown={(e) => handleResizePointerDown(e, "e")} />
          <div className="absolute top-6 left-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/20"
            onPointerDown={(e) => handleResizePointerDown(e, "w")} />
          <div className="absolute bottom-0 left-6 right-6 h-1.5 cursor-ns-resize hover:bg-primary/20"
            onPointerDown={(e) => handleResizePointerDown(e, "s")} />
          <div className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize hover:bg-primary/30"
            onPointerDown={(e) => handleResizePointerDown(e, "se")} />
          <div className="absolute bottom-0 left-0 h-3 w-3 cursor-nesw-resize hover:bg-primary/30"
            onPointerDown={(e) => handleResizePointerDown(e, "sw")} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export default function Home() {
  const pipeline = usePipeline();
  const couple = useCouple();
  const {
    fixedLoras,
    addFixedLora,
    updateFixedLora,
    removeFixedLora,
    variableLoras,
    selectedVariableLora,
    setSelectedVariableLora,
    addVariableLora,
    updateVariableLora,
    removeVariableLora,
    setVariableLoraArchived,
    physicalPresets,
    scenePresets,
    countPresets,
    posePresets,
    otherPresets,
    selectedPhysicalIds,
    togglePhysicalPreset,
    selectedSceneId,
    setSelectedSceneId,
    selectedCountId,
    selectCountPreset,
    selectedPoseId,
    selectPosePreset,
    reorderPresets,
    selectedOtherIds,
    toggleOtherPreset,
    additionalPrompt,
    setAdditionalPrompt,
    negativePrompt,
    setNegativePrompt,
    fixedTags,
    setFixedTags,
    resetFixedTags,
    addPreset,
    updatePreset,
    removePreset,
    presetCategories,
    addCategory,
    renameCategory,
    removeCategory,
    settings,
    setSettings,
    batchCount,
    setBatchCount,
    variationEnabled,
    setVariationEnabled,
    variationTags,
    setVariationTags,
    additionalPromptMode,
    setAdditionalPromptMode,
    batchPresetSets,
    captureCurrentSettings,
    saveBatchPresetSet,
    removeBatchPresetSet,
    reorderBatchPresetSets,
    duplicateBatchPresetSet,
    runBatchPresets,
    queue,
    queueRunning,
    startQueue,
    pauseQueue,
    addToQueue,
    updateQueueItem,
    removeFromQueue,
    runItemNext,
    requeueItem,
    cancelCurrent,
    redoCurrentReroll,
    redoCurrentSamePrompt,
    cancelAllPending,
    clearLog,
    isProcessing,
    wsConnected,
    progress,
    previewUrl,
    currentJobImages,
    currentBatchPrompt,
    gallery,
    clearGallery,
    refreshGalleryFromFs,
    exportData,
    importData,
    panelSizes,
    setPanelSizes,
    promptPreviewPos,
    setPromptPreviewPos,
    etaPos,
    setEtaPos,
  } = pipeline;

  const importInputRef = useRef<HTMLInputElement>(null);

  // Track which left-panel tab is active for queue dispatch
  const [leftTabMode, setLeftTabMode] = useState<"normal" | "couple">("normal");

  // Left icon nav: section refs + scroll handler
  const sectionRefs = useRef<
    Partial<Record<LeftSectionId, HTMLDivElement | null>>
  >({});
  const handleScrollTo = useCallback((id: LeftSectionId) => {
    if (id.startsWith("p-")) {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      sectionRefs.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Prompt preview
  // ---------------------------------------------------------------------------
  const [previewSeed, setPreviewSeed] = useState(0);
  const refreshPreview = useCallback(() => setPreviewSeed((s) => s + 1), []);

  const resolveRandom = useCallback((p: Preset): Preset => {
    if (p.promptMode !== "random") return p;
    const lines = p.prompt.split("\n").filter((s) => s.trim());
    if (!lines.length) return p;
    return { ...p, prompt: lines[Math.floor(Math.random() * lines.length)] };
  }, []);

  // Destructure individual stable fields from couple to avoid spurious useMemo re-runs
  // when the hook returns a new object reference on every parent render (e.g. GPU polling).
  const { activeConfig: coupleActiveConfig, selectedNormalCountId: coupleCountId, selectedNormalSceneId: coupleSceneId } = couple;

  const { previewPositive, previewNegative, hasRandom } = useMemo(() => {
    if (leftTabMode === "couple") {
      const cCount =
        countPresets.find((p) => p.id === coupleCountId) ?? null;
      const cScene =
        scenePresets.find((p) => p.id === coupleSceneId) ?? null;
      const allPresets = [...physicalPresets, ...posePresets, ...otherPresets];
      const effectiveRegions = coupleActiveConfig.regions.map((r) =>
        applySelectedPresets(r, allPresets),
      );
      return {
        previewPositive: buildCouplePrompt({
          fixedTags,
          basePrompt: coupleActiveConfig.basePrompt,
          countPrompt: cCount?.prompt ?? "",
          scenePrompt: cScene?.prompt ?? "",
          regions: effectiveRegions,
        }),
        previewNegative: negativePrompt,
        hasRandom: false,
      };
    }

    const selPhysicals = physicalPresets
      .filter((p) => selectedPhysicalIds.includes(p.id))
      .map(resolveRandom);
    const selScene = scenePresets.find((p) => p.id === selectedSceneId);
    const selCount = countPresets.find((p) => p.id === selectedCountId);
    const selPose = posePresets.find((p) => p.id === selectedPoseId);
    const selOthers = otherPresets
      .filter((p) => selectedOtherIds.includes(p.id))
      .map(resolveRandom);

    const addLines = additionalPrompt
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    let previewAdditional = additionalPrompt.trim();
    if (additionalPromptMode === "random" && addLines.length > 0) {
      previewAdditional = addLines[Math.floor(Math.random() * addLines.length)];
    }

    const base = assemblePositivePrompt({
      variableLora: selectedVariableLora,
      fixedLoras,
      selectedPhysicalPresets: selPhysicals,
      selectedCountPreset: selCount ? resolveRandom(selCount) : null,
      selectedPosePreset: selPose ? resolveRandom(selPose) : null,
      selectedScenePreset: selScene ? resolveRandom(selScene) : null,
      selectedOtherPresets: selOthers,
      additionalPrompt: previewAdditional,
      fixedPrefix: fixedTags,
    });

    let previewPositive = base;
    if (variationEnabled && variationTags.length > 0) {
      const tag =
        variationTags[Math.floor(Math.random() * variationTags.length)];
      previewPositive = `${base}\n\n${tag}`;
    }

    const allSelected = [
      ...physicalPresets.filter((p) => selectedPhysicalIds.includes(p.id)),
      ...(selScene ? [selScene] : []),
      ...(selCount ? [selCount] : []),
      ...(selPose ? [selPose] : []),
      ...otherPresets.filter((p) => selectedOtherIds.includes(p.id)),
    ];
    const hasRandom =
      allSelected.some((p) => p.promptMode === "random") ||
      (additionalPromptMode === "random" && addLines.length > 1) ||
      variationEnabled;

    return { previewPositive, previewNegative: negativePrompt, hasRandom };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    previewSeed,
    leftTabMode,
    coupleActiveConfig,
    coupleCountId,
    coupleSceneId,
    fixedTags,
    fixedLoras,
    negativePrompt,
    physicalPresets,
    scenePresets,
    countPresets,
    posePresets,
    otherPresets,
    selectedPhysicalIds,
    selectedSceneId,
    selectedCountId,
    selectedPoseId,
    selectedOtherIds,
    selectedVariableLora,
    additionalPrompt,
    additionalPromptMode,
    variationEnabled,
    variationTags,
    resolveRandom,
  ]);

  // Unified "add to queue" that dispatches based on active mode
  const handleAddToQueue = () => {
    if (leftTabMode === "couple") {
      const { activeConfig, selectedNormalCountId, selectedNormalSceneId } =
        couple;
      const selectedCount =
        countPresets.find((p) => p.id === selectedNormalCountId) ?? null;
      const selectedScene =
        scenePresets.find((p) => p.id === selectedNormalSceneId) ?? null;
      const allPresets = [...physicalPresets, ...posePresets, ...otherPresets];
      const effectiveRegions = activeConfig.regions.map((r) =>
        applySelectedPresets(r, allPresets),
      );
      const positivePrompt = buildCouplePrompt({
        fixedTags,
        basePrompt: activeConfig.basePrompt,
        countPrompt: selectedCount?.prompt ?? "",
        scenePrompt: selectedScene?.prompt ?? "",
        regions: effectiveRegions,
      });
      const loras = activeConfig.regions
        .filter((r) => r.lora !== null)
        .map((r) => r.lora as LoraEntry);
      const label =
        activeConfig.name +
        (selectedScene ? ` / ${selectedScene.name}` : "") +
        (activeConfig.controlNet.enabled ? " [CN]" : "");
      pipeline.addCoupleToQueue({
        positivePrompt,
        negativePrompt,
        loras,
        coupleSettings: settings,
        coupleBatchCount: batchCount,
        label,
        colorMaskControlNet: activeConfig.controlNet,
        colorMaskRegions: effectiveRegions,
      });
    } else {
      addToQueue();
    }
  };

  // Cancel confirmation modal
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Lifted so SamplerSettings' checkpoint quick-link can also open it
  const [modelManagerOpen, setModelManagerOpen] = useState(false);

  const addedLoraNames = useMemo(
    () => new Set(variableLoras.map((l) => l.name)),
    [variableLoras],
  );

  // アーカイブ済みの可変LoRAはプリセット実行時（一括キュー実行前設定）の選択肢から除外する
  const nonArchivedVariableLoras = useMemo(
    () => variableLoras.filter((l) => !l.isArchived),
    [variableLoras],
  );

  // Stable ref so keyboard handler always calls the latest handleAddToQueue
  const addToQueueRef = useRef(handleAddToQueue);
  addToQueueRef.current = handleAddToQueue;

  // GPU monitor state
  const [gpuSnapshots, setGpuSnapshots] = useState<SysSnapshot[]>([]);
  const [gpuCollapsed, setGpuCollapsed] = useState(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/process/sysinfo");
        if (!res.ok) return;
        const data = await res.json();
        setGpuSnapshots((prev) => [
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
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  const currentItem = queue.find((i) => i.status === "running") ?? null;
  const pendingCount = queue.filter((i) => i.status === "pending").length;

  // Keyboard shortcuts — placed after currentItem is declared
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Enter — add current settings to queue
      if (e.ctrlKey && e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        addToQueueRef.current();
        return;
      }
      // Esc — prompt to cancel the running job
      if (e.key === "Escape" && currentItem && !showCancelModal) {
        setShowCancelModal(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentItem, showCancelModal]);
  const selectedCount =
    selectedPhysicalIds.length +
    (selectedSceneId ? 1 : 0) +
    (selectedCountId ? 1 : 0) +
    (selectedPoseId ? 1 : 0) +
    selectedOtherIds.length +
    (selectedVariableLora ? 1 : 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppHeader
        active="home"
        modelManagerOpen={modelManagerOpen}
        onModelManagerOpenChange={setModelManagerOpen}
        onAddLora={(entry) => addVariableLora(entry)}
        onRemoveLora={(name) => {
          const idx = variableLoras.findIndex((l) => l.name === name);
          if (idx !== -1) {
            removeVariableLora(idx);
            if (selectedVariableLora?.name === name) setSelectedVariableLora(null);
          }
        }}
        onSelectCheckpoint={(fileName) =>
          setSettings({ ...settings, checkpoint: fileName })
        }
        addedLoraNames={addedLoraNames}
        activeCheckpoint={settings.checkpoint}
      >
        {wsConnected ? (
          <Wifi className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}

        {isProcessing ? (
          <Badge variant="default" className="gap-1.5 text-xs">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-300" />
            生成中
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            接続しました
          </Badge>
        )}
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            待機 {pendingCount}件
          </Badge>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={exportData}
          title="設定をエクスポート"
        >
          <Download className="h-3.5 w-3.5" />
          エクスポート
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => importInputRef.current?.click()}
          title="設定をインポート"
        >
          <Upload className="h-3.5 w-3.5" />
          インポート
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importData(file);
            e.target.value = "";
          }}
        />
      </AppHeader>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftIconNav activeTab={leftTabMode} onScrollTo={handleScrollTo} />
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel
            id="left"
            defaultSize={`${panelSizes["left"]}%`}
            minSize="15%"
            maxSize="45%"
            className="flex flex-col border-r"
            onResize={(size) =>
              setPanelSizes({
                ...panelSizes,
                left: Math.round(size.asPercentage),
              })
            }
          >
            <Tabs
              defaultValue="normal"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onValueChange={(v) => setLeftTabMode(v as "normal" | "couple")}
            >
              <TabsList className="m-2 mb-0 shrink-0">
                <TabsTrigger value="normal" className="flex-1 text-xs">
                  通常
                </TabsTrigger>
                <TabsTrigger value="couple" className="flex-1 text-xs">
                  マルチキャラ
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="normal"
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <div className="px-3">
                  <div
                    ref={(el) => {
                      sectionRefs.current.lora = el;
                    }}
                  >
                    <Section
                      title="LoRA設定"
                      badge={selectedVariableLora ? "1選択中" : undefined}
                    >
                      <LoraPanel
                        fixedLoras={fixedLoras}
                        onAddFixedLora={addFixedLora}
                        onUpdateFixedLora={updateFixedLora}
                        onRemoveFixedLora={removeFixedLora}
                        variableLoras={variableLoras}
                        selectedVariableLora={selectedVariableLora}
                        onSelectVariableLora={setSelectedVariableLora}
                        onAddVariableLora={addVariableLora}
                        onUpdateVariableLora={updateVariableLora}
                        onRemoveVariableLora={removeVariableLora}
                        onArchiveVariableLora={setVariableLoraArchived}
                      />
                    </Section>
                  </div>

                  <div
                    ref={(el) => {
                      sectionRefs.current.prompt = el;
                    }}
                  >
                    <Section
                      title="プロンプト"
                      badge={
                        selectedCount > 0 ? `${selectedCount}選択` : undefined
                      }
                    >
                      <PromptBuilder
                        variableLora={selectedVariableLora}
                        physicalPresets={physicalPresets}
                        scenePresets={scenePresets}
                        countPresets={countPresets}
                        posePresets={posePresets}
                        otherPresets={otherPresets}
                        selectedPhysicalIds={selectedPhysicalIds}
                        selectedSceneId={selectedSceneId}
                        selectedCountId={selectedCountId}
                        selectedPoseId={selectedPoseId}
                        selectedOtherIds={selectedOtherIds}
                        additionalPrompt={additionalPrompt}
                        additionalPromptMode={additionalPromptMode}
                        negativePrompt={negativePrompt}
                        onTogglePhysical={togglePhysicalPreset}
                        onSelectScene={setSelectedSceneId}
                        onSelectCount={selectCountPreset}
                        onSelectPose={selectPosePreset}
                        onToggleOther={toggleOtherPreset}
                        onSetAdditional={setAdditionalPrompt}
                        onSetAdditionalMode={setAdditionalPromptMode}
                        onSetNegative={setNegativePrompt}
                        fixedTags={fixedTags}
                        onSetFixedTags={setFixedTags}
                        onResetFixedTags={resetFixedTags}
                        onAddPreset={addPreset}
                        onUpdatePreset={updatePreset}
                        onRemovePreset={removePreset}
                        onReorderPresets={reorderPresets}
                        presetCategories={presetCategories}
                        onAddCategory={addCategory}
                        onRenameCategory={renameCategory}
                        onRemoveCategory={removeCategory}
                      />
                    </Section>
                  </div>

                  <div
                    ref={(el) => {
                      sectionRefs.current.sampler = el;
                    }}
                  >
                    <Section title="サンプラー設定" defaultOpen={false}>
                      <SamplerSettings
                        settings={settings}
                        onChange={setSettings}
                        onOpenModelManager={() => setModelManagerOpen(true)}
                      />
                    </Section>
                  </div>

                  <div
                    ref={(el) => {
                      sectionRefs.current.variation = el;
                    }}
                  >
                    <Section
                      title="ランダム構図"
                      defaultOpen={false}
                      badge={variationEnabled ? "ON" : undefined}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={variationEnabled}
                            onCheckedChange={setVariationEnabled}
                            id="variation-toggle"
                          />
                          <Label
                            htmlFor="variation-toggle"
                            className="cursor-pointer text-xs"
                          >
                            ランダム構図
                            {variationEnabled && (
                              <span className="text-primary">が有効</span>
                            )}
                          </Label>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          有効にすると、各枚ごとにランダムな構図タグが追加されます。1タグ1行で入力。
                        </p>
                        <Textarea
                          value={variationTags.join("\n")}
                          onChange={(e) =>
                            setVariationTags(
                              e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                          rows={7}
                          className="font-mono text-xs"
                          placeholder="from above,&#10;from below,&#10;dutch angle,"
                        />
                      </div>
                    </Section>
                  </div>

                  <div
                    ref={(el) => {
                      sectionRefs.current.tagdb = el;
                    }}
                  >
                    <Section title="タグDB設定" defaultOpen={false}>
                      <TagSettings />
                    </Section>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="couple"
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <div
                  ref={(el) => {
                    sectionRefs.current["couple-top"] = el;
                  }}
                >
                  <CouplePanel
                    couple={couple}
                    fixedTags={fixedTags}
                    negativePrompt={negativePrompt}
                    setNegativePrompt={setNegativePrompt}
                    physicalPresets={physicalPresets}
                    posePresets={posePresets}
                    otherPresets={otherPresets}
                    countPresets={countPresets}
                    scenePresets={scenePresets}
                    onAddPreset={addPreset}
                    onUpdatePreset={updatePreset}
                    onRemovePreset={removePreset}
                    onReorderPresets={reorderPresets}
                    presetCategories={presetCategories}
                    onAddCategory={addCategory}
                    onRenameCategory={renameCategory}
                    onRemoveCategory={removeCategory}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            id="center"
            defaultSize={`${panelSizes["center"]}%`}
            minSize="20%"
            className="flex flex-col overflow-hidden"
            onResize={(size) =>
              setPanelSizes({
                ...panelSizes,
                center: Math.round(size.asPercentage),
              })
            }
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
              <div className="mb-2 flex items-center gap-2">
                <BatchQueueDialog
                  batchPresetSets={batchPresetSets}
                  onSaveSet={saveBatchPresetSet}
                  onRemoveSet={removeBatchPresetSet}
                  onReorderSets={reorderBatchPresetSets}
                  onDuplicateSet={duplicateBatchPresetSet}
                  onRunPresets={runBatchPresets}
                  onCaptureCurrentSettings={captureCurrentSettings}
                  variableLoras={nonArchivedVariableLoras}
                  physicalPresets={physicalPresets}
                  scenePresets={scenePresets}
                  countPresets={countPresets}
                  posePresets={posePresets}
                  otherPresets={otherPresets}
                  currentSettings={settings}
                />
                <QuickAddToBatch
                  batchPresetSets={batchPresetSets}
                  onCaptureCurrentSettings={captureCurrentSettings}
                  onSaveSet={saveBatchPresetSet}
                />
                {variationEnabled && (
                  <Badge variant="secondary" className="text-[10px]">
                    ランダム構図 ON
                  </Badge>
                )}
              </div>
              <PreviewPanel
                previewUrl={previewUrl}
                progress={progress}
                isProcessing={isProcessing}
                currentItem={currentItem}
                batchCount={batchCount}
                onBatchCountChange={setBatchCount}
                onAddToQueue={handleAddToQueue}
                onCancel={cancelCurrent}
                onRedoReroll={redoCurrentReroll}
                onRedoSamePrompt={redoCurrentSamePrompt}
                currentJobImages={currentJobImages}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            id="right"
            defaultSize={`${panelSizes["right"]}%`}
            minSize="15%"
            maxSize="50%"
            className="flex flex-col border-l"
            onResize={(size) =>
              setPanelSizes({
                ...panelSizes,
                right: Math.round(size.asPercentage),
              })
            }
          >
            <Tabs
              defaultValue="queue"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <TabsList className="m-2 mb-0 shrink-0">
                <TabsTrigger value="queue" className="flex-1 text-xs">
                  キュー
                  {queue.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      {queue.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="gallery" className="flex-1 text-xs">
                  ギャラリー
                  {gallery.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      {gallery.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="queue"
                className="min-h-0 flex-1 overflow-hidden p-2"
              >
                <QueueManager
                  queue={queue}
                  queueRunning={queueRunning}
                  onRemove={removeFromQueue}
                  onCancelAllPending={cancelAllPending}
                  onClearLog={clearLog}
                  onStart={startQueue}
                  onPause={pauseQueue}
                  onEdit={updateQueueItem}
                  onRunNext={runItemNext}
                  onRequeue={requeueItem}
                />
              </TabsContent>

              <TabsContent
                value="gallery"
                className="min-h-0 flex-1 overflow-hidden p-2"
              >
                <GalleryPanel
                  gallery={gallery}
                  onClear={clearGallery}
                  onRefreshFs={refreshGalleryFromFs}
                />
              </TabsContent>
            </Tabs>

            <GpuMonitor
              snapshots={gpuSnapshots}
              collapsed={gpuCollapsed}
              onToggle={() => setGpuCollapsed((v) => !v)}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <FloatingEtaOverlay
        queue={queue}
        isProcessing={isProcessing}
        currentJobImages={currentJobImages}
        pos={etaPos}
        onPosChange={setEtaPos}
      />

      <FloatingPromptPreview
        positivePrompt={currentBatchPrompt ?? previewPositive}
        negativePrompt={previewNegative}
        hasRandom={hasRandom}
        isLive={isProcessing && currentBatchPrompt !== null}
        onRefresh={refreshPreview}
        pos={promptPreviewPos}
        onPosChange={setPromptPreviewPos}
      />

      <AlertDialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>生成を中止しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              現在実行中のキューアイテムを中止します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="gap-2 text-xs">
              キャンセル <Kbd>Esc</Kbd>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              autoFocus
              className="gap-2 text-xs"
              onClick={cancelCurrent}
            >
              中止する <Kbd>Enter</Kbd>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
