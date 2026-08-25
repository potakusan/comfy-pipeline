"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanel } from "@/components/ui/resizable";
import QueueManager from "@/components/pipeline/queue/queue-manager";
import GalleryPanel from "@/components/pipeline/gallery-panel";
import GpuMonitor from "@/components/pipeline/gpu-monitor";
import { type SysSnapshot } from "@/hooks/use-sys-monitor";
import type { PipelineHook } from "@/hooks/pipeline/use-pipeline";

export interface RightPanelProps {
  pipeline: PipelineHook;
  gpuSnapshots: SysSnapshot[];
}

export default function RightPanel({ pipeline, gpuSnapshots }: RightPanelProps) {
  const {
    queue,
    queueRunning,
    removeFromQueue,
    cancelAllPending,
    clearLog,
    startQueue,
    pauseQueue,
    updateQueueItem,
    runItemNext,
    requeueItem,
    gallery,
    clearGallery,
    refreshGalleryFromFs,
    panelSizes,
    setPanelSizes,
  } = pipeline;

  const [gpuCollapsed, setGpuCollapsed] = useState(false);

  return (
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

        <TabsContent value="queue" className="min-h-0 flex-1 overflow-hidden p-2">
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

        <TabsContent value="gallery" className="min-h-0 flex-1 overflow-hidden p-2">
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
  );
}
