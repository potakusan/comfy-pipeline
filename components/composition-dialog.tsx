"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Pencil,
  Eraser,
  Trash2,
  Save,
  Upload,
  CheckCircle,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { CoupleRegion } from "@/lib/couple";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedImage {
  id: string;
  name: string;
  /** "pose" = black sketch on white; "colormap" = colored regions on black */
  mode: "pose" | "colormap";
  /** Filename in ComfyUI's input folder */
  comfyFileName: string;
  /** Small thumbnail (data URL) for preview */
  thumbnail: string;
  createdAt: number;
}

const LS_KEY = "cp_saved_images";

function lsGetImages(): SavedImage[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function lsSetImages(images: SavedImage[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(images));
}

// ---------------------------------------------------------------------------
// Flood fill
// ---------------------------------------------------------------------------

function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
) {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const idx = (x: number, y: number) => (y * width + x) * 4;
  const start = idx(startX, startY);
  const targetColor: [number, number, number, number] = [
    data[start],
    data[start + 1],
    data[start + 2],
    data[start + 3],
  ];

  if (
    targetColor[0] === fillColor[0] &&
    targetColor[1] === fillColor[1] &&
    targetColor[2] === fillColor[2] &&
    targetColor[3] === fillColor[3]
  )
    return;

  const stack: [number, number][] = [[startX, startY]];
  const matches = (x: number, y: number) => {
    const i = idx(x, y);
    return (
      data[i] === targetColor[0] &&
      data[i + 1] === targetColor[1] &&
      data[i + 2] === targetColor[2] &&
      data[i + 3] === targetColor[3]
    );
  };
  const paint = (x: number, y: number) => {
    const i = idx(x, y);
    data[i] = fillColor[0];
    data[i + 1] = fillColor[1];
    data[i + 2] = fillColor[2];
    data[i + 3] = fillColor[3];
  };

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
    if (!matches(cx, cy)) continue;
    paint(cx, cy);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
}

// ---------------------------------------------------------------------------
// Drawing canvas
// ---------------------------------------------------------------------------

const CANVAS_SIZE = 512;

function DrawingCanvas({
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
      {/* Canvas container with optional colormap overlay for pose mode */}
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

// ---------------------------------------------------------------------------
// Saved image card
// ---------------------------------------------------------------------------

function SavedImageCard({
  img,
  onApply,
  onDelete,
  onEdit,
  isApplied,
  isEditing,
}: {
  img: SavedImage;
  onApply: (img: SavedImage) => void;
  onDelete: (id: string) => void;
  onEdit: (img: SavedImage) => void;
  isApplied: boolean;
  isEditing: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col gap-1 rounded-md border p-1.5 transition-colors ${
        isEditing
          ? "border-amber-400 bg-amber-500/10 ring-1 ring-amber-400"
          : isApplied
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
      }`}
    >
      {isApplied && !isEditing && (
        <CheckCircle className="absolute right-1 top-1 h-3.5 w-3.5 text-primary" />
      )}
      {isEditing && (
        <span className="absolute right-1 top-1 text-[9px] font-bold text-amber-400">編集中</span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.thumbnail}
        alt={img.name}
        className="h-20 w-full cursor-pointer rounded object-cover"
        title="ダブルクリックで編集"
        onDoubleClick={() => onEdit(img)}
      />
      <span className="truncate text-[10px] font-medium">{img.name}</span>
      <Badge variant="outline" className="w-fit text-[9px]">
        {img.mode === "pose" ? "ポーズ" : "カラーマップ"}
      </Badge>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 flex-1 text-[10px]"
          onClick={() => onApply(img)}
        >
          適用
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(img.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export interface CompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regions: CoupleRegion[];
  currentPoseImageName: string | null;
  currentColorMapImageName: string | null;
  onApplyPose: (filename: string) => void;
  onApplyColorMap: (filename: string) => void;
}

export default function CompositionDialog({
  open,
  onOpenChange,
  regions,
  currentPoseImageName,
  currentColorMapImageName,
  onApplyPose,
  onApplyColorMap,
}: CompositionDialogProps) {
  const [mode, setMode] = useState<"pose" | "colormap">("colormap");
  const [tool, setTool] = useState<"pencil" | "fill" | "eraser">("pencil");
  const [brushSize, setBrushSize] = useState(8);
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [editingImage, setEditingImage] = useState<SavedImage | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load saved images from localStorage
  useEffect(() => {
    if (open) setSavedImages(lsGetImages());
  }, [open]);

  // Load a saved image onto the canvas for editing
  const handleEdit = useCallback(async (img: SavedImage) => {
    setEditingImage(img);
    setSaveName(img.name);
    // Switch to the image's mode first (canvas will re-init)
    handleModeChange(img.mode);
    // Fetch full-size image from ComfyUI and draw onto canvas
    try {
      const url = `/api/comfy/view?filename=${encodeURIComponent(img.comfyFileName)}&type=input`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        URL.revokeObjectURL(objectUrl);
      };
      image.src = objectUrl;
    } catch {
      // Fallback: draw thumbnail
      const image = new Image();
      image.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      };
      image.src = img.thumbnail;
      toast.error("ComfyUIから画像を取得できませんでした。サムネイルで代用します。");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModeChange = (newMode: "pose" | "colormap") => {
    setMode(newMode);
    // Auto-select a sensible default color
    if (newMode === "pose") {
      setSelectedColor("#000000");
    } else {
      setSelectedColor(regions[0]?.colorHex ?? "#ff0000");
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = mode === "pose" ? "#ffffff" : "#000000";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!saveName.trim()) {
      toast.error("保存名を入力してください");
      return;
    }

    setIsSaving(true);
    const isOverwrite = editingImage !== null;
    try {
      // Generate thumbnail
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 128;
      thumbCanvas.height = 128;
      thumbCanvas.getContext("2d")!.drawImage(canvas, 0, 0, 128, 128);
      const thumbnail = thumbCanvas.toDataURL("image/png");

      // Upload to ComfyUI
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
        ),
      );
      const timestamp = Date.now();
      // Overwrite: reuse the existing filename so ComfyUI replaces the file
      const fileName = isOverwrite
        ? editingImage!.comfyFileName
        : `${mode}_${saveName.trim().replace(/\s+/g, "_")}_${timestamp}.png`;

      const formData = new FormData();
      formData.append("image", blob, fileName);
      formData.append("overwrite", isOverwrite ? "true" : "false");
      formData.append("type", "input");

      const res = await fetch("/api/comfy/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const comfyFileName: string = data.name ?? fileName;

      // Update or prepend in local list
      const saved: SavedImage = {
        id: isOverwrite ? editingImage!.id : crypto.randomUUID(),
        name: saveName.trim(),
        mode,
        comfyFileName,
        thumbnail,
        createdAt: timestamp,
      };
      const next = isOverwrite
        ? savedImages.map((i) => (i.id === saved.id ? saved : i))
        : [saved, ...savedImages];
      lsSetImages(next);
      setSavedImages(next);
      setSaveName("");
      setEditingImage(null);
      toast.success(`「${saved.name}」を${isOverwrite ? "上書き" : ""}保存しました`);
    } catch (err) {
      toast.error("保存に失敗しました: " + String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Draw uploaded image onto canvas
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    e.target.value = "";
  };

  const handleApply = (img: SavedImage) => {
    if (img.mode === "pose") {
      onApplyPose(img.comfyFileName);
      toast.success(`ポーズ画像を「${img.name}」に設定しました`);
    } else {
      onApplyColorMap(img.comfyFileName);
      toast.success(`カラーマップを「${img.name}」に設定しました`);
    }
  };

  const handleDelete = (id: string) => {
    const next = savedImages.filter((i) => i.id !== id);
    lsSetImages(next);
    setSavedImages(next);
  };

  const poseImages = savedImages.filter((i) => i.mode === "pose");
  const colormapImages = savedImages.filter((i) => i.mode === "colormap");

  // Colormap thumbnail used as underlay when drawing the pose sketch
  const activeColormapThumbnail = colormapImages.find(
    (i) => i.comfyFileName === currentColorMapImageName,
  )?.thumbnail;

  const colorPalette =
    mode === "colormap"
      ? ["#000000", ...regions.map((r) => r.colorHex)]
      : ["#000000", "#444444", "#888888", "#ffffff"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl! gap-0 p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-sm">構図エディタ</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 gap-0 overflow-hidden">
          {/* Left: canvas + tools */}
          <div className="flex w-105 shrink-0 flex-col gap-3 border-r p-4">
            {/* Mode tabs */}
            <Tabs
              value={mode}
              onValueChange={(v) => handleModeChange(v as "pose" | "colormap")}
            >
              <TabsList className="h-7 w-full">
                <TabsTrigger value="colormap" className="flex-1 text-xs">
                  ① カラーマップ
                </TabsTrigger>
                <TabsTrigger value="pose" className="flex-1 text-xs">
                  ② ポーズラフ
                </TabsTrigger>
              </TabsList>

              <TabsContent value={mode} className="mt-2">
                <p className="text-[10px] text-muted-foreground">
                  {mode === "colormap"
                    ? "STEP 1: 各キャラクターの占有領域をそれぞれの色で塗りつぶしてください。背景は黒のままにします。"
                    : "STEP 2: カラーマップを下絵に、黒ペンでポーズ・構図のラフを描いてください。CN-posetestの入力として使用されます。"}
                </p>
              </TabsContent>
            </Tabs>

            {/* Tools */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border">
                {(["pencil", "fill", "eraser"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
                    className={`flex h-7 w-8 items-center justify-center transition-colors ${
                      tool === t
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                    title={
                      t === "pencil"
                        ? "ペン"
                        : t === "fill"
                          ? "塗りつぶし"
                          : "消しゴム"
                    }
                  >
                    {t === "pencil" && <Pencil className="h-3.5 w-3.5" />}
                    {t === "fill" && (
                      <span className="text-[11px] font-bold">Fill</span>
                    )}
                    {t === "eraser" && <Eraser className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>

              {tool !== "fill" && (
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    サイズ
                  </span>
                  <Slider
                    value={[brushSize]}
                    onValueChange={([v]) => setBrushSize(v)}
                    min={1}
                    max={60}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-5 text-right font-mono text-[10px]">
                    {brushSize}
                  </span>
                </div>
              )}
            </div>

            {/* Color palette */}
            <div className="flex flex-wrap gap-1">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`h-6 w-6 rounded border-2 transition-all ${
                    selectedColor === color
                      ? "border-primary scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border"
                title="カスタム色"
              />
            </div>

            {/* Canvas */}
            <DrawingCanvas
              mode={mode}
              regions={regions}
              tool={tool}
              brushSize={brushSize}
              selectedColor={selectedColor}
              onClear={handleClear}
              canvasRef={canvasRef}
              colormapThumbnail={activeColormapThumbnail}
            />

            <Separator />

            {/* Save */}
            <div className="space-y-2">
              {editingImage && (
                <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1">
                  <span className="flex-1 truncate text-[10px] text-amber-400">
                    編集中: {editingImage.name}
                  </span>
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => { setEditingImage(null); setSaveName(""); handleClear(); }}
                  >
                    キャンセル
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="保存名 (例: 構図A)"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                />
                <Button
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  onClick={handleSave}
                  disabled={isSaving || !saveName.trim()}
                >
                  <Save className="mr-1 h-3 w-3" />
                  {isSaving ? "保存中..." : editingImage ? "上書き保存" : "保存"}
                </Button>
              </div>
              <label className="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                <Upload className="h-3 w-3" />
                既存ファイルを読み込む
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {/* Right: saved images gallery */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              保存済み画像
            </Label>

            {savedImages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <ImageIcon className="h-8 w-8 opacity-40" />
                <span className="text-xs">保存済み画像なし</span>
              </div>
            )}

            {poseImages.length > 0 && (
              <>
                <span className="text-[10px] font-medium text-muted-foreground">
                  ポーズラフ
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {poseImages.map((img) => (
                    <SavedImageCard
                      key={img.id}
                      img={img}
                      isApplied={img.comfyFileName === currentPoseImageName}
                      isEditing={editingImage?.id === img.id}
                      onApply={handleApply}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              </>
            )}

            {colormapImages.length > 0 && (
              <>
                <Separator />
                <span className="text-[10px] font-medium text-muted-foreground">
                  カラーマップ
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {colormapImages.map((img) => (
                    <SavedImageCard
                      key={img.id}
                      img={img}
                      isApplied={img.comfyFileName === currentColorMapImageName}
                      isEditing={editingImage?.id === img.id}
                      onApply={handleApply}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
