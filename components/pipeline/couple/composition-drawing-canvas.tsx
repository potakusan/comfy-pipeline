"use client";
import { useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { CoupleRegion } from "@/lib/comfy/couple";
import { floodFill, hexToRgba } from "@/lib/composition-canvas";

export const CANVAS_SIZE = 512;

export default function DrawingCanvas({
  mode,
  regions,
  tool,
  brushSize,
  selectedColor,
  onClear,
  canvasRef,
  colormapThumbnail,
}: {
  mode: "pose" | "colormap";
  regions: CoupleRegion[];
  tool: "pencil" | "fill" | "eraser";
  brushSize: number;
  selectedColor: string;
  onClear: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Thumbnail data URL of the colormap shown as underlay in pose mode */
  colormapThumbnail?: string;
}) {
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = mode === "pose" ? "#ffffff" : "#000000";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }, [mode, canvasRef]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const drawAt = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      if (tool === "fill") return;
      const color =
        tool === "eraser"
          ? mode === "pose"
            ? "#ffffff"
            : "#000000"
          : selectedColor;
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (lastPos.current) {
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
      lastPos.current = { x, y };
    },
    [tool, selectedColor, brushSize, mode],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);

    if (tool === "fill") {
      floodFill(ctx, pos.x, pos.y, hexToRgba(selectedColor));
      return;
    }

    isDrawing.current = true;
    lastPos.current = null;
    drawAt(ctx, pos.x, pos.y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawAt(ctx, ...(Object.values(getPos(e)) as [number, number]));
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full rounded border border-border overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="w-full cursor-crosshair"
          style={{ imageRendering: "pixelated", display: "block" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        {mode === "pose" && colormapThumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={colormapThumbnail}
            alt="colormap guide"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ opacity: 0.3, mixBlendMode: "multiply" }}
          />
        )}
      </div>
      {mode === "colormap" && (
        <div className="flex flex-wrap gap-1">
          {regions.map((r) => (
            <span
              key={r.id}
              className="rounded px-2 py-0.5 text-[10px] font-mono text-white"
              style={{ backgroundColor: r.colorHex }}
            >
              {r.name}: {r.colorHex}
            </span>
          ))}
          <span className="rounded bg-black px-2 py-0.5 text-[10px] font-mono text-white">
            背景: #000000
          </span>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-destructive"
        onClick={onClear}
      >
        <Trash2 className="mr-1 h-3 w-3" />
        クリア
      </Button>
    </div>
  );
}
