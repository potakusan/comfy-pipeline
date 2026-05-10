"use client";
import { useRef, useState, useEffect } from "react";
import { usePipeline } from "@/hooks/use-pipeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import LoraPanel from "@/components/lora-panel";
import PromptBuilder from "@/components/prompt-builder";
import SamplerSettings from "@/components/sampler-settings";
import TagSettings from "@/components/tag-settings";
import PreviewPanel from "@/components/preview-panel";
import QueueManager from "@/components/queue-manager";
import GalleryPanel from "@/components/gallery-panel";
import BatchQueueDialog from "@/components/batch-queue-dialog";
import QuickAddToBatch from "@/components/quick-add-to-batch";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import {
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Download,
  Upload,
  Wand2,
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
      {/* Header bar — always visible */}
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

      {/* Expanded chart */}
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
// Home page
// ---------------------------------------------------------------------------

export default function Home() {
  const pipeline = usePipeline();
  const {
    variableLoras,
    selectedVariableLora,
    setSelectedVariableLora,
    addVariableLora,
    updateVariableLora,
    removeVariableLora,
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
    runBatchPresets,
    queue,
    addToQueue,
    removeFromQueue,
    cancelCurrent,
    isProcessing,
    wsConnected,
    progress,
    previewUrl,
    currentJobImages,
    gallery,
    clearGallery,
    refreshGalleryFromFs,
    exportData,
    importData,
    panelSizes,
    setPanelSizes,
  } = pipeline;

  const importInputRef = useRef<HTMLInputElement>(null);

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
  const selectedCount =
    selectedPhysicalIds.length +
    (selectedSceneId ? 1 : 0) +
    (selectedCountId ? 1 : 0) +
    (selectedPoseId ? 1 : 0) +
    selectedOtherIds.length +
    (selectedVariableLora ? 1 : 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <h1 className="shrink-0 text-sm font-bold tracking-tight">
          ComfyPipeline
        </h1>
        <Separator orientation="vertical" className="h-4" />

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

        <div className="flex-1" />

        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
          <a href="/process">
            <Wand2 className="h-3.5 w-3.5" />
            画像処理
          </a>
        </Button>
        <Separator orientation="vertical" className="h-4" />

        {/* Export / Import */}
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
      </header>

      {/* Main 3-panel resizable layout */}
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1"
      >
        {/* Left panel */}
        <ResizablePanel
          id="left"
          defaultSize={`${panelSizes["left"]}%`}
          minSize="15%"
          maxSize="45%"
          className="flex flex-col border-r"
          onResize={(size) =>
            setPanelSizes({ ...panelSizes, left: Math.round(size.asPercentage) })
          }
        >
          <div className="flex-1 overflow-y-auto">
            <div className="px-3">
              <Section
                title="LoRA設定"
                badge={selectedVariableLora ? "1選択中" : undefined}
              >
                <LoraPanel
                  variableLoras={variableLoras}
                  selectedVariableLora={selectedVariableLora}
                  onSelectVariableLora={setSelectedVariableLora}
                  onAddVariableLora={addVariableLora}
                  onUpdateVariableLora={updateVariableLora}
                  onRemoveVariableLora={removeVariableLora}
                />
              </Section>

              <Section
                title="プロンプト"
                badge={selectedCount > 0 ? `${selectedCount}選択` : undefined}
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
                />
              </Section>

              <Section title="サンプラー設定" defaultOpen={false}>
                <SamplerSettings settings={settings} onChange={setSettings} />
              </Section>

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

              <Section title="タグDB設定" defaultOpen={false}>
                <TagSettings />
              </Section>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center: Preview */}
        <ResizablePanel
          id="center"
          defaultSize={`${panelSizes["center"]}%`}
          minSize="20%"
          className="flex flex-col overflow-hidden"
          onResize={(size) =>
            setPanelSizes({ ...panelSizes, center: Math.round(size.asPercentage) })
          }
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <div className="mb-2 flex items-center gap-2">
              <BatchQueueDialog
                batchPresetSets={batchPresetSets}
                onSaveSet={saveBatchPresetSet}
                onRemoveSet={removeBatchPresetSet}
                onRunPresets={runBatchPresets}
                onCaptureCurrentSettings={captureCurrentSettings}
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
              onAddToQueue={addToQueue}
              onCancel={cancelCurrent}
              currentJobImages={currentJobImages}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel: Queue & Gallery + GPU monitor */}
        <ResizablePanel
          id="right"
          defaultSize={`${panelSizes["right"]}%`}
          minSize="15%"
          maxSize="50%"
          className="flex flex-col border-l"
          onResize={(size) =>
            setPanelSizes({ ...panelSizes, right: Math.round(size.asPercentage) })
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
              <QueueManager queue={queue} onRemove={removeFromQueue} />
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

          {/* GPU monitor */}
          <GpuMonitor
            snapshots={gpuSnapshots}
            collapsed={gpuCollapsed}
            onToggle={() => setGpuCollapsed((v) => !v)}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
