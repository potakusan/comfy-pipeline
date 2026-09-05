"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ImageRef, type ImageRefPool } from "@/lib/comfy";
import {
  uploadImageToComfyInput,
  comfyInputImageUrl,
} from "@/lib/comfy-upload";
import { apiFetch } from "@/lib/api-client";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Upload, ImageDown, X, Loader2, RefreshCw, Settings2 } from "lucide-react";
import I2iPoolManagerDialog, {
  type I2iGroup,
  i2iImageUrl,
} from "@/components/pipeline/prompt/i2i-pool-manager-dialog";

interface ImageRefSectionProps {
  imageRef: ImageRef | null;
  onChange: (ref: ImageRef | null) => void;
  imageRefPool: ImageRefPool | null;
  onPoolChange: (pool: ImageRefPool | null) => void;
  /** 直近に生成した画像の出力相対パス(あれば「直近の生成画像から」を出す) */
  lastGeneratedPath?: string;
}

const DEFAULT_DENOISE = 0.8;
const PRESETS: { label: string; denoise: number }[] = [
  { label: "構図重視", denoise: 0.6 },
  { label: "標準", denoise: 0.8 },
  { label: "大きく変える", denoise: 0.9 },
];

function DenoiseControl({
  denoise,
  onChange,
}: {
  denoise: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          参照 denoise（小さいほど下絵に忠実）
        </span>
        <span className="font-mono text-[10px]">{denoise.toFixed(2)}</span>
      </div>
      <Slider
        value={[denoise]}
        onValueChange={([v]) => onChange(v)}
        min={0.2}
        max={0.95}
        step={0.05}
      />
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.denoise)}
            className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
              Math.abs(denoise - p.denoise) < 0.001
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ImageRefSection({
  imageRef,
  onChange,
  imageRefPool,
  onPoolChange,
  lastGeneratedPath,
}: ImageRefSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // デフォルトは「構図プール」。単一画像がセット済みならそちら。ユーザーが切り替えたら override。
  const [modeOverride, setModeOverride] = useState<"single" | "pool" | null>(null);
  const mode =
    modeOverride ?? (imageRefPool ? "pool" : imageRef ? "single" : "pool");
  const [groups, setGroups] = useState<I2iGroup[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);

  const loadGroups = useCallback(
    () =>
      apiFetch<{ groups: I2iGroup[] }>("/api/i2i/groups")
        .then((res) => setGroups(res.groups))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    if (mode === "pool") loadGroups();
  }, [mode, loadGroups]);

  const switchMode = (m: "single" | "pool") => {
    setModeOverride(m);
    setError(null);
    if (m === "pool") onChange(null);
    else onPoolChange(null);
  };

  // --- single ---
  const setFromBlob = async (blob: Blob, label: string) => {
    setBusy(true);
    setError(null);
    try {
      const name = await uploadImageToComfyInput(blob, `ref_${Date.now()}.png`);
      onChange({
        name,
        denoise: imageRef?.denoise ?? DEFAULT_DENOISE,
        sourceLabel: label,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (file) void setFromBlob(file, file.name);
  };

  const handleFromLastGenerated = async () => {
    if (!lastGeneratedPath) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/comfy/output/image?path=${encodeURIComponent(lastGeneratedPath)}`,
      );
      if (!res.ok) throw new Error(`画像の取得に失敗しました (HTTP ${res.status})`);
      const blob = await res.blob();
      await setFromBlob(blob, lastGeneratedPath.split("/").pop() ?? lastGeneratedPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  // --- pool ---
  const stageGroup = async (group: string) => {
    if (!group) {
      onPoolChange(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ names: string[] }>("/api/i2i/stage", {
        method: "POST",
        body: JSON.stringify({ group }),
      });
      onPoolChange({
        group,
        denoise: imageRefPool?.denoise ?? DEFAULT_DENOISE,
        names: res.names,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(["pool", "single"] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 rounded border px-2 py-0.5 text-[10px] transition-colors ${
              mode === m
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            {m === "single" ? "単一画像" : "構図プール"}
          </button>
        ))}
      </div>

      {mode === "single" && !imageRef && (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground transition-colors hover:border-muted-foreground hover:bg-muted/30"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            画像をドロップ / クリックして選択
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {lastGeneratedPath && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full gap-1.5 text-[11px]"
              disabled={busy}
              onClick={handleFromLastGenerated}
            >
              <ImageDown className="h-3 w-3" />
              直近の生成画像から
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground">
            指定すると img2img（下絵）で生成します。未指定なら通常どおり。
          </p>
        </>
      )}

      {mode === "single" && imageRef && (
        <>
          <div className="flex items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={comfyInputImageUrl(imageRef.name)}
              alt="下絵"
              className="h-20 w-20 shrink-0 rounded-md border object-cover"
            />
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[10px] text-muted-foreground"
                title={imageRef.sourceLabel ?? imageRef.name}
              >
                {imageRef.sourceLabel ?? imageRef.name}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                onClick={() => {
                  onChange(null);
                  setError(null);
                }}
              >
                <X className="h-3 w-3" />
                クリア
              </Button>
            </div>
          </div>
          <DenoiseControl
            denoise={imageRef.denoise}
            onChange={(v) => onChange({ ...imageRef, denoise: v })}
          />
        </>
      )}

      {mode === "pool" && (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">グループ</span>
            {imageRefPool && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 w-6 shrink-0 p-0 text-muted-foreground"
                disabled={busy}
                title="再ステージ（画像を追加した後に）"
                onClick={() => void stageGroup(imageRefPool.group)}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 shrink-0 p-0 text-muted-foreground ${imageRefPool ? "" : "ml-auto"}`}
              title="構図プールを管理"
              onClick={() => setManagerOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="rounded-md border border-dashed px-2 py-3 text-center text-[10px] text-muted-foreground">
              構図プールがありません。管理から作成してください。
            </p>
          ) : (
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {groups.map((g) => {
                const active = imageRefPool?.group === g.path;
                const extra = g.count - g.thumbnails.length;
                return (
                  <button
                    key={g.path}
                    onClick={() => void stageGroup(g.path)}
                    style={{ marginLeft: g.depth * 10 }}
                    className={`flex w-full items-center gap-1.5 rounded-md border p-1 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex shrink-0 gap-0.5">
                      {g.thumbnails.map((t) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={t}
                          src={i2iImageUrl(t, true)}
                          alt=""
                          loading="lazy"
                          className="h-9 w-9 rounded border object-cover"
                        />
                      ))}
                      {extra > 0 && (
                        <span className="flex h-9 w-9 items-center justify-center rounded border bg-muted/50 text-[9px] text-muted-foreground">
                          +{extra}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">
                        {g.path.split("/").pop()}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {g.depth > 0 ? `${g.path} · ` : ""}
                        {g.count}枚
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {imageRefPool && (
            <>
              <p className="text-[10px] text-muted-foreground">
                「{imageRefPool.group}」 {imageRefPool.names.length}枚 ·
                生成ごとにランダムで1枚
              </p>
              <DenoiseControl
                denoise={imageRefPool.denoise}
                onChange={(v) => onPoolChange({ ...imageRefPool, denoise: v })}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                onClick={() => onPoolChange(null)}
              >
                <X className="h-3 w-3" />
                選択解除
              </Button>
            </>
          )}

          <I2iPoolManagerDialog
            open={managerOpen}
            onOpenChange={setManagerOpen}
            onGroupsChanged={() => {
              loadGroups();
              if (imageRefPool) void stageGroup(imageRefPool.group);
            }}
          />
        </>
      )}

      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
