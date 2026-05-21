"use client";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";

interface GalleryPanelProps {
  gallery: GalleryImage[];
  onClear: () => void;
  onRefreshFs: () => Promise<void>;
}

interface ViewerState {
  images: GalleryImage[];
  index: number;
}

const PAGE_SIZE = 10;

function imageUrl(img: GalleryImage) {
  return `/api/comfy/output/image?path=${encodeURIComponent(img.path)}`;
}

function thumbUrl(img: GalleryImage) {
  return `/api/comfy/output/thumbnail?path=${encodeURIComponent(img.path)}`;
}

function loraShortName(loraName: string) {
  if (!loraName || loraName === "no-lora") return "固定のみ";
  return (
    loraName.split("/").pop()?.replace(".safetensors", "").substring(0, 24) ??
    loraName
  );
}

function getFolder(path: string) {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : "(root)";
}

function downloadImageMeta(img: GalleryImage) {
  const blob = new Blob([JSON.stringify(img, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stem = img.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "image";
  a.download = `${stem}.json`;
  a.click();
  URL.revokeObjectURL(url);
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

  const thumbs = images.slice(0, 2);
  const expandedImages = images.slice(0, visibleCount);

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
        <div className="grid grid-cols-2 gap-1 p-1.5">
          {thumbs.map((img, i) => (
            <button
              key={`${img.path}-${i}`}
              onClick={() => onOpenViewer(images, i)}
              className="group relative overflow-hidden rounded border border-border bg-muted/20 transition-all hover:border-primary/50 hover:shadow-md hover:shadow-black/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div
          ref={expandScrollRef}
          onScroll={handleExpandScroll}
          className="max-h-96 overflow-y-auto p-1.5"
        >
          <div className="grid grid-cols-2 gap-1">
            {expandedImages.map((img, i) => (
              <button
                key={`${img.path}-${i}`}
                onClick={() => onOpenViewer(images, i)}
                className="group relative overflow-hidden rounded border border-border bg-muted/20 transition-all hover:border-primary/50 hover:shadow-md hover:shadow-black/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  {img.queueLabel && (
                    <p className="text-[9px] text-white/60">{img.queueLabel}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
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

  useEffect(() => {
    setVisibleFolderCount(PAGE_SIZE);
  }, [filterLora]);

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

  const selectedImg = viewer ? viewer.images[viewer.index] : null;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="mb-2 shrink-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Select value={filterLora} onValueChange={setFilterLora}>
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

      {/* Folder list */}
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

      {/* Full-size viewer dialog */}
      <Dialog
        open={viewer !== null}
        onOpenChange={(open) => !open && setViewer(null)}
      >
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-full min-w-full flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-2.5">
            <DialogTitle className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
              <span className="flex-1 truncate font-mono">
                {selectedImg?.path}
              </span>
              <span className="shrink-0 tabular-nums">
                {viewer ? `${viewer.index + 1} / ${viewer.images.length}` : ""}
              </span>
              {selectedImg && (
                <a
                  href={imageUrl(selectedImg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedImg && viewer && (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/20 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(selectedImg)}
                  alt={selectedImg.path}
                  className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                />

                {viewer.images.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setViewer((v) =>
                          v ? { ...v, index: Math.max(0, v.index - 1) } : null,
                        )
                      }
                      disabled={viewer.index === 0}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white disabled:opacity-20 hover:bg-black/70"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() =>
                        setViewer((v) =>
                          v
                            ? {
                                ...v,
                                index: Math.min(
                                  v.images.length - 1,
                                  v.index + 1,
                                ),
                              }
                            : null,
                        )
                      }
                      disabled={viewer.index === viewer.images.length - 1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white disabled:opacity-20 hover:bg-black/70"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              <div className="shrink-0 border-t border-border bg-card/50 px-4 py-2.5">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {loraShortName(selectedImg.loraName)}
                  </Badge>
                  {selectedImg.queueLabel && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-muted-foreground"
                    >
                      {selectedImg.queueLabel}
                    </Badge>
                  )}
                  {selectedImg.id && (
                    <span className="font-mono text-[9px] text-muted-foreground/50 select-all">
                      {selectedImg.id}
                    </span>
                  )}
                  <div className="ml-auto">
                    <button
                      onClick={() => downloadImageMeta(selectedImg)}
                      title="メタデータをJSONでダウンロード"
                      className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3 w-3" />
                      JSON
                    </button>
                  </div>
                </div>

                {selectedImg.settings && (
                  <details className="mb-1 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      サンプラー設定
                    </summary>
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 rounded bg-muted/30 p-2 font-mono text-[10px]">
                      {[
                        ["チェックポイント", selectedImg.settings.checkpoint],
                        ["サイズ", `${selectedImg.settings.width}×${selectedImg.settings.height}`],
                        ["ステップ", selectedImg.settings.steps],
                        ["CFG", selectedImg.settings.cfg],
                        ["サンプラー", selectedImg.settings.sampler],
                        ["スケジューラ", selectedImg.settings.scheduler],
                        ["デノイズ", selectedImg.settings.denoise],
                        ["シード", selectedImg.settings.randomizeSeed ? "ランダム" : selectedImg.settings.seed],
                      ].map(([k, v]) => (
                        <div key={k as string} className="flex gap-1">
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="truncate">{v as string | number}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {selectedImg.positivePrompt && (
                  <details className="mb-1 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      ポジティブプロンプト
                    </summary>
                    <div className="mt-1 max-h-28 overflow-y-auto rounded bg-muted/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-line">
                      {selectedImg.positivePrompt}
                    </div>
                  </details>
                )}

                {selectedImg.negativePrompt && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      ネガティブプロンプト
                    </summary>
                    <div className="mt-1 max-h-20 overflow-y-auto rounded bg-muted/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-line">
                      {selectedImg.negativePrompt}
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
