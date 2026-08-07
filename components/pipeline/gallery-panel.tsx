"use client";
import { useState, useMemo, useRef, useCallback } from "react";
import { type GalleryImage } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { thumbUrl, loraShortName, getFolder } from "@/lib/gallery-display";
import GalleryImageViewerDialog, {
  type ViewerState,
} from "@/components/pipeline/gallery-image-viewer-dialog";

interface GalleryPanelProps {
  gallery: GalleryImage[];
  onClear: () => void;
  onRefreshFs: () => Promise<void>;
}

const PAGE_SIZE = 10;

function FolderThumbButton({
  img,
  onOpen,
  showQueueLabel,
}: {
  img: GalleryImage;
  onOpen: () => void;
  showQueueLabel: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className="group relative overflow-hidden rounded border border-border bg-muted/20 transition-all hover:border-primary/50 hover:shadow-md hover:shadow-black/30"
    >
      <img
        src={thumbUrl(img)}
        alt={img.path}
        className="aspect-[3/4] w-full object-cover"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-[9px] font-medium leading-tight text-white">
          {loraShortName(img.loraName)}
        </p>
        {showQueueLabel && img.queueLabel && (
          <p className="text-[9px] text-white/60">{img.queueLabel}</p>
        )}
      </div>
    </button>
  );
}

function FolderCard({
  folder,
  images,
  onOpenViewer,
}: {
  folder: string;
  images: GalleryImage[];
  onOpenViewer: (images: GalleryImage[], index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const expandScrollRef = useRef<HTMLDivElement>(null);

  const handleExpandScroll = useCallback(() => {
    const el = expandScrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, images.length));
    }
  }, [images.length]);

  const visibleImages = expanded ? images.slice(0, visibleCount) : images.slice(0, 2);

  const thumbGrid = (
    <div className="grid grid-cols-2 gap-1">
      {visibleImages.map((img, i) => (
        <FolderThumbButton
          key={`${img.path}-${i}`}
          img={img}
          onOpen={() => onOpenViewer(images, i)}
          showQueueLabel={expanded}
        />
      ))}
    </div>
  );

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-border bg-card/30">
      <div className="flex items-center gap-2 border-b border-border/50 px-2 py-1.5">
        <span className="flex-1 truncate font-mono text-[10px] text-muted-foreground">
          {folder}
        </span>
        <Badge variant="outline" className="shrink-0 text-[9px]">
          {images.length}枚
        </Badge>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>

      {!expanded ? (
        <div className="p-1.5">{thumbGrid}</div>
      ) : (
        <div
          ref={expandScrollRef}
          onScroll={handleExpandScroll}
          className="max-h-96 overflow-y-auto p-1.5"
        >
          {thumbGrid}
          {visibleCount < images.length && (
            <p className="py-2 text-center text-[10px] text-muted-foreground">
              スクロールでさらに読み込み...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function GalleryPanel({
  gallery,
  onClear,
  onRefreshFs,
}: GalleryPanelProps) {
  const [filterLora, setFilterLora] = useState<string>("all");
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleFolderCount, setVisibleFolderCount] = useState(PAGE_SIZE);
  const galleryScrollRef = useRef<HTMLDivElement>(null);

  const loraNames = useMemo(() => {
    const names = new Set(gallery.map((img) => img.loraName));
    return Array.from(names);
  }, [gallery]);

  const filtered = useMemo(() => {
    const imgs =
      filterLora === "all"
        ? gallery
        : gallery.filter((img) => img.loraName === filterLora);
    return [...imgs].sort((a, b) => b.createdAt - a.createdAt);
  }, [gallery, filterLora]);

  const folders = useMemo(() => {
    const map = new Map<string, GalleryImage[]>();
    for (const img of filtered) {
      const folder = getFolder(img.path);
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(img);
    }
    return Array.from(map.entries())
      .map(([folder, images]) => ({
        folder,
        images: [...images].sort((a, b) => b.createdAt - a.createdAt),
        latestCreatedAt: Math.max(...images.map((i) => i.createdAt)),
      }))
      .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);
  }, [filtered]);

  const handleFilterLoraChange = (value: string) => {
    setFilterLora(value);
    setVisibleFolderCount(PAGE_SIZE);
  };

  const handleGalleryScroll = useCallback(() => {
    const el = galleryScrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      setVisibleFolderCount((c) => Math.min(c + PAGE_SIZE, folders.length));
    }
  }, [folders.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefreshFs();
    setRefreshing(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 shrink-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Select value={filterLora} onValueChange={handleFilterLoraChange}>
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                すべて ({gallery.length}枚)
              </SelectItem>
              {loraNames.map((name) => {
                const count = gallery.filter((i) => i.loraName === name).length;
                return (
                  <SelectItem key={name} value={name} className="text-xs">
                    {loraShortName(name)} ({count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleRefresh}
            disabled={refreshing}
            title="outputフォルダを再スキャン"
            aria-label="outputフォルダを再スキャン"
          >
            <RefreshCw
              className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onClear}
            disabled={gallery.length === 0}
            title="ギャラリーをクリア"
            aria-label="ギャラリーをクリア"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {gallery.length === 0 && (
          <p className="text-center text-[10px] text-muted-foreground">
            生成後に自動追加、または↑の更新ボタンでスキャン
          </p>
        )}
      </div>

      <div
        ref={galleryScrollRef}
        onScroll={handleGalleryScroll}
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {filtered.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-xs text-muted-foreground">画像がありません</p>
          </div>
        ) : (
          <>
            {folders.slice(0, visibleFolderCount).map(({ folder, images }) => (
              <FolderCard
                key={folder}
                folder={folder}
                images={images}
                onOpenViewer={(imgs, idx) =>
                  setViewer({ images: imgs, index: idx })
                }
              />
            ))}
            {visibleFolderCount < folders.length && (
              <p className="py-2 text-center text-[10px] text-muted-foreground">
                スクロールでさらに読み込み...
              </p>
            )}
          </>
        )}
      </div>

      <GalleryImageViewerDialog
        viewer={viewer}
        onClose={() => setViewer(null)}
        onNavigate={(index) => setViewer((v) => (v ? { ...v, index } : null))}
      />
    </div>
  );
}
