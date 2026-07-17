"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  RefreshCw,
  Trash2,
  Sparkles,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Grid2x2,
} from "lucide-react";
import { useGallery } from "@/hooks/use-gallery";
import AppHeader from "@/components/app-header";
import GalleryFolderList from "@/components/gallery-folder-list";
import GalleryThumbGrid from "@/components/gallery-thumb-grid";
import GalleryPromptPanel from "@/components/gallery-prompt-panel";
import GalleryPromptWindow from "@/components/gallery-prompt-window";
import GalleryGeneratingWindow from "@/components/gallery-generating-window";
import GalleryPoseSummary, { computePoseStats } from "@/components/gallery-pose-summary";
import GalleryDeleteConfirmDialog from "@/components/gallery-delete-confirm-dialog";
import GalleryMosaicModal from "@/components/gallery-mosaic-modal";
import { getPoseGroup, type GalleryImageEntry } from "@/lib/gallery";

function imageUrl(path: string) {
  return `/api/comfy/output/image?path=${encodeURIComponent(path)}`;
}

export default function GalleryPage() {
  const gallery = useGallery();
  const [deleteTarget, setDeleteTarget] = useState<GalleryImageEntry | null>(null);
  const [mosaicModalOpen, setMosaicModalOpen] = useState(false);

  const selected: GalleryImageEntry | null = gallery.visibleImages[gallery.selectedIndex] ?? null;

  // Pose stats always reflect the full (unfiltered) image list so the
  // "released/total" denominator stays meaningful even when "show released
  // only" is on.
  const poseStats = useMemo(() => computePoseStats(gallery.images), [gallery.images]);
  const activePose = selected ? getPoseGroup(selected.filename) : null;
  const handleSelectPose = (pose: string) => {
    const idx = gallery.visibleImages.findIndex((i) => getPoseGroup(i.filename) === pose);
    if (idx >= 0) gallery.setSelectedIndex(idx);
  };

  // Arrow keys = prev/next image in the current (possibly filtered) set.
  // Space = toggle the selected image's release state.
  const keyStateRef = useRef({
    selected,
    visibleCount: gallery.visibleImages.length,
    setSelectedIndex: gallery.setSelectedIndex,
    toggleRelease: gallery.toggleRelease,
  });
  keyStateRef.current = {
    selected,
    visibleCount: gallery.visibleImages.length,
    setSelectedIndex: gallery.setSelectedIndex,
    toggleRelease: gallery.toggleRelease,
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      const { selected, visibleCount, setSelectedIndex, toggleRelease } = keyStateRef.current;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(visibleCount - 1, i + 1));
      } else if (e.code === "Space") {
        e.preventDefault();
        if (selected) toggleRelease(selected);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppHeader active="gallery">
        {gallery.error && (
          <span className="text-xs text-destructive">{gallery.error}</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={gallery.refreshFolders}
          disabled={gallery.foldersLoading}
        >
          <RefreshCw className={`h-3 w-3 ${gallery.foldersLoading ? "animate-spin" : ""}`} />
          更新
        </Button>
      </AppHeader>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        {/* Left column: folders */}
        <ResizablePanel
          id="gallery-left"
          defaultSize="18%"
          minSize="12%"
          maxSize="35%"
          className="flex flex-col border-r"
        >
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              フォルダ
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 gap-1 px-1.5 text-[10px]"
              disabled={!gallery.selectedFolder}
              onClick={() => setMosaicModalOpen(true)}
              title="このフォルダにモザイク処理を実行"
            >
              <Grid2x2 className="h-3 w-3" />
              モザイク処理
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <GalleryFolderList
              folders={gallery.folders}
              selectedFolder={gallery.selectedFolder}
              onSelect={gallery.selectFolder}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Center: preview */}
        <ResizablePanel
          id="gallery-center"
          defaultSize="50%"
          minSize="30%"
          className="flex min-w-0 flex-col"
        >
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {selected?.path ?? "—"}
            </span>
            {selected && (
              <>
                <a
                  href={imageUrl(selected.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  title="別タブで開く"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Button
                  variant={selected.releasePath ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => gallery.toggleRelease(selected)}
                  title="販売用に選択"
                >
                  {selected.releasePath ? (
                    <BookmarkCheck className="h-3 w-3" />
                  ) : (
                    <Bookmark className="h-3 w-3" />
                  )}
                  販売用に選択
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  disabled={gallery.regenerating || !selected.meta}
                  onClick={() => gallery.regenerateImage(selected)}
                  title="同じプロンプト・別シードで再生成"
                >
                  <Sparkles className="h-3 w-3" />
                  別シードで再生成
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(selected)}
                  title="削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/20 p-4">
            {selected ? (
              <img
                src={imageUrl(selected.path)}
                alt={selected.filename}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                左のフォルダから画像を選択してください
              </p>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Right column: thumbnails (top) / prompt preview (bottom) */}
        <ResizablePanel
          id="gallery-right"
          defaultSize="32%"
          minSize="20%"
          maxSize="50%"
          className="flex flex-col border-l"
        >
          <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
            <ResizablePanel defaultSize="55%" minSize="20%" className="flex flex-col">
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5">
                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  サムネイル
                </span>
                <label className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Checkbox
                    checked={gallery.showReleasedOnly}
                    onCheckedChange={(v) => gallery.setShowReleasedOnly(v === true)}
                  />
                  販売用のみ表示
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Checkbox
                    checked={gallery.groupByPose}
                    onCheckedChange={(v) => gallery.setGroupByPose(v === true)}
                  />
                  ポーズごとにグループ化
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <GalleryThumbGrid
                  images={gallery.visibleImages}
                  selectedIndex={gallery.selectedIndex}
                  onSelect={gallery.setSelectedIndex}
                  onToggleRelease={gallery.toggleRelease}
                  groupByPose={gallery.groupByPose}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="45%" minSize="20%" className="flex flex-col">
              <div className="shrink-0 border-b px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                ポーズ別集計
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <GalleryPoseSummary
                  stats={poseStats}
                  activePose={activePose}
                  onSelectPose={handleSelectPose}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      <GalleryDeleteConfirmDialog
        entry={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await gallery.deleteImage(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      <GalleryPromptWindow pos={gallery.promptWindowPos} onPosChange={gallery.setPromptWindowPos}>
        <GalleryPromptPanel
          entry={selected}
          regenerating={gallery.regenerating}
          onRegenerate={(overrides) => {
            if (selected) gallery.regenerateImage(selected, overrides);
          }}
        />
      </GalleryPromptWindow>

      {gallery.regenerating && (
        <GalleryGeneratingWindow
          pos={gallery.regenWindowPos}
          onPosChange={gallery.setRegenWindowPos}
          previewUrl={gallery.regenPreviewUrl}
          progress={gallery.regenProgress}
          onCancel={gallery.cancelRegenerate}
          onRetry={gallery.redoRegenerate}
        />
      )}

      {gallery.selectedFolder && (
        <GalleryMosaicModal
          open={mosaicModalOpen}
          onClose={() => setMosaicModalOpen(false)}
          folder={gallery.selectedFolder}
        />
      )}
    </div>
  );
}
