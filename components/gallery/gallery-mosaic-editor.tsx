"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Undo2, Redo2, Save, Loader2 } from "lucide-react";
import { computeAutoMosaicSize, applyMosaicToPath, mimeFromExt } from "@/lib/mosaic-canvas";

const MIN_MOSAIC_SIZE = 2;
const MAX_MOSAIC_SIZE = 60;
const MAX_HISTORY = 20;
const MIN_PATH_POINTS = 3;

function imageUrl(path: string) {
  return `/api/comfy/output/image?path=${encodeURIComponent(path)}`;
}

export default function GalleryMosaicEditor({
  path,
  onSaved,
}: {
  path: string;
  onSaved: (path: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const naturalSizeRef = useRef<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mosaicSize, setMosaicSize] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pastRef = useRef<ImageData[]>([]);
  const futureRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const pathRef = useRef<{ x: number; y: number }[]>([]);

  const filename = path.split("/").pop() ?? path;

  // ベースcanvasとオーバーレイcanvasを常に同じ表示サイズ(displaySize)にするための
  // 計算。object-fit任せの2枚重ねだと、それぞれ独立に矩形計算されて微妙にずれ
  // ("なぞった位置"と"実際に塗られる位置"が合わない)ため、JS側で単一の値を
  // 明示的に両方へ渡す
  const recomputeDisplaySize = useCallback(() => {
    const container = containerRef.current;
    const natural = naturalSizeRef.current;
    if (!container || !natural) return;
    const style = getComputedStyle(container);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const availW = Math.max(1, container.clientWidth - paddingX);
    const availH = Math.max(1, container.clientHeight - paddingY);
    const scale = Math.min(1, availW / natural.w, availH / natural.h);
    setDisplaySize({
      w: Math.max(1, Math.round(natural.w * scale)),
      h: Math.max(1, Math.round(natural.h * scale)),
    });
  }, []);

  // パネルのリサイズ(ResizablePanelのドラッグ等)にも追従する
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => recomputeDisplaySize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recomputeDisplaySize]);

  // 選択が変わるたびに実解像度でロードし直す。undo/redo履歴も画像ごとにリセット
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setDisplaySize(null);
    pastRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !overlay || !ctx) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      overlay.width = img.naturalWidth;
      overlay.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      naturalSizeRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      recomputeDisplaySize();
      setMosaicSize(computeAutoMosaicSize(Math.max(img.naturalWidth, img.naturalHeight)));
      setLoading(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      setLoadError("画像の読み込みに失敗しました");
      setLoading(false);
    };
    // /api/comfy/output/image は immutable な強キャッシュを返すため、同一セッション内で
    // 保存→再選択したときに古いバイト列を掴まないよう常にキャッシュバストする
    img.src = `${imageUrl(path)}&t=${Date.now()}`;

    return () => {
      cancelled = true;
    };
  }, [path, recomputeDisplaySize]);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    pastRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(prev, 0, 0);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(next, 0, 0);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;
    setSaving(true);
    setSaveError(null);
    try {
      const mime = mimeFromExt(filename);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), mime, 0.92),
      );
      if (!blob) throw new Error("画像の生成に失敗しました");
      const res = await fetch(`/api/gallery/mosaic/save?path=${encodeURIComponent(path)}`, {
        method: "POST",
        headers: { "Content-Type": mime },
        body: blob,
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      // undo/redo履歴には触れない — 保存後も取り消し/やり直しを継続できるようにする
      onSaved(path);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [filename, path, loading, onSaved]);

  // Ctrl+Z / Ctrl+Y / Ctrl+S — このエディタがマウントされている間だけ有効
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!(e.ctrlKey || e.metaKey)) return;

      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      } else if (key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, handleSave]);

  const getImagePos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const overlay = e.currentTarget;
    const rect = overlay.getBoundingClientRect();
    const scaleX = overlay.width / rect.width;
    const scaleY = overlay.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // なぞっている最中の囲み線(実線)と、離した時に閉じる予告線(破線)をオーバーレイに描く
  const redrawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext("2d");
    if (!overlay || !ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const points = pathRef.current;
    if (points.length === 0) return;

    const lineWidth = Math.max(2, overlay.width * 0.0015);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    if (points.length > 1) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.setLineDash([lineWidth * 2, lineWidth * 2]);
      ctx.beginPath();
      ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.lineTo(points[0].x, points[0].y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (loading) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pathRef.current = [getImagePos(e)];
    isDrawingRef.current = true;
    redrawOverlay();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    pathRef.current.push(getImagePos(e));
    redrawOverlay();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const points = pathRef.current;
    pathRef.current = [];
    const overlay = overlayRef.current;
    const overlayCtx = overlay?.getContext("2d");
    overlayCtx?.clearRect(0, 0, overlay!.width, overlay!.height);

    if (points.length < MIN_PATH_POINTS) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    pushHistory();
    applyMosaicToPath(ctx, points, mosaicSize);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
          {path}
        </span>
        {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={!canUndo}
          onClick={undo}
          title="取り消し (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={!canRedo}
          onClick={redo}
          title="やり直し (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={saving || loading}
          onClick={handleSave}
          title="上書き保存 (Ctrl+S)"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          保存
        </Button>
      </div>

      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/20 p-4"
      >
        {loadError ? (
          <p className="text-xs text-destructive">{loadError}</p>
        ) : (
          <div
            className="relative rounded-lg shadow-2xl"
            style={displaySize ? { width: displaySize.w, height: displaySize.h } : undefined}
          >
            <canvas
              ref={canvasRef}
              className={`h-full w-full rounded-lg ${loading ? "invisible" : ""}`}
            />
            <canvas
              ref={overlayRef}
              className={`absolute inset-0 h-full w-full touch-none ${
                loading ? "invisible" : "cursor-crosshair"
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
        )}
        {loading && !loadError && (
          <Loader2 className="absolute h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t px-3 py-2">
        <Label className="shrink-0 text-xs text-muted-foreground">モザイクサイズ</Label>
        <Slider
          min={MIN_MOSAIC_SIZE}
          max={MAX_MOSAIC_SIZE}
          step={1}
          value={[mosaicSize]}
          onValueChange={([v]) => setMosaicSize(v)}
          className="flex-1"
        />
        <Input
          type="number"
          min={MIN_MOSAIC_SIZE}
          max={MAX_MOSAIC_SIZE}
          value={mosaicSize}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isNaN(v)) {
              setMosaicSize(Math.min(MAX_MOSAIC_SIZE, Math.max(MIN_MOSAIC_SIZE, v)));
            }
          }}
          className="h-7 w-16 text-xs"
        />
        <span className="text-[10px] text-muted-foreground">px</span>
      </div>
    </div>
  );
}
