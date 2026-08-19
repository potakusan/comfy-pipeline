"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import AppHeader from "@/components/common/app-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Play,
  Loader2,
  FolderOpen,
  Download,
  Info,
} from "lucide-react";
import type { ProcessJob } from "@/lib/process/process-jobs";
import type { RunRequest } from "@/app/api/process/run/route";
import type { FolderInfo } from "@/app/api/process/dirs/route";
import {
  MosaicConfig,
  DEFAULT_MOSAIC,
} from "@/components/common/mosaic-config";
import {
  type SysSnapshot,
  fmtBytes,
  DEFAULT_RESIZE,
  calcAutoScale,
  estimateFormatMultiplier,
  thumbUrl,
} from "@/components/process/process-helpers";
import ResourceMonitor from "@/components/process/resource-monitor";
import FolderPickerModal from "@/components/process/folder-picker-modal";
import ConfigSection from "@/components/process/config-section";
import ResizeConfig from "@/components/process/resize-config";
import JobProgress from "@/components/process/job-progress";
import BeforeAfterGallery from "@/components/process/before-after-gallery";

// ---- main page ----
export default function ProcessPage() {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [loadingDirs, setLoadingDirs] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [mosaicConfig, setMosaicConfig] = useState(DEFAULT_MOSAIC);
  const [resizeConfig, setResizeConfig] = useState(DEFAULT_RESIZE);

  const [estimate, setEstimate] = useState<{
    count: number;
    currentBytes: number;
    estimatedBytes: number;
  } | null>(null);

  const effectiveScale = useMemo(
    () =>
      resizeConfig.autoTarget && estimate
        ? calcAutoScale(estimate.currentBytes, resizeConfig.targetMB)
        : resizeConfig.scalePercent,
    [
      resizeConfig.autoTarget,
      resizeConfig.targetMB,
      resizeConfig.scalePercent,
      estimate,
    ],
  );

  // 圧縮(画像形式変換)も踏まえた出力サイズの目安。resize無効時はnull
  const estimatedFinalBytes = useMemo(() => {
    if (!resizeConfig.enabled || !estimate) return null;
    const formatMultiplier = estimateFormatMultiplier(
      resizeConfig.convertFormat,
      resizeConfig.convertQuality,
    );
    return (
      estimate.currentBytes * (effectiveScale / 100) ** 2 * formatMultiplier
    );
  }, [
    resizeConfig.enabled,
    resizeConfig.convertFormat,
    resizeConfig.convertQuality,
    estimate,
    effectiveScale,
  ]);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ProcessJob | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Local sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    saved: number;
    skipped: number;
    total: number;
    localPath: string;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sysinfo polling
  const [snapshots, setSnapshots] = useState<SysSnapshot[]>([]);
  const sysinfoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDirs = useCallback(async () => {
    setLoadingDirs(true);
    try {
      const url = localMode
        ? "/api/process/dirs?local=true"
        : "/api/process/dirs";
      const res = await fetch(url);
      const data = await res.json();
      setFolders(data.dirs ?? []);
    } finally {
      setLoadingDirs(false);
    }
  }, [localMode]);

  useEffect(() => {
    loadDirs();
  }, [loadDirs]);

  useEffect(() => {
    setSelectedFolder("");
    setEstimate(null);
  }, [localMode]);

  // Estimate size when folder or scale changes.
  // scalePercentはスライダーのドラッグ中に連続更新されるため、デバウンスを挟んで
  // ドラッグ中の連続APIコールを防ぐ(止まってから300ms後に1回だけ呼ぶ)。
  useEffect(() => {
    if (!selectedFolder) {
      setEstimate(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/process/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: selectedFolder,
          scalePercent: resizeConfig.scalePercent,
          local: localMode,
        }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then(setEstimate)
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedFolder, resizeConfig.scalePercent, localMode]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/process/status/${jobId}`);
        if (!res.ok) return;
        const data: ProcessJob = await res.json();
        if (!data.id) return; // guard against error response shape
        setJob((prev) => ({
          ...prev,
          ...data,
          log: data.log ?? prev?.log ?? [],
          processedImages: data.processedImages ?? prev?.processedImages ?? [],
        }));
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch {}
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  // Sysinfo polling — always on, 2 s interval
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/process/sysinfo");
        if (!res.ok) return;
        const data = await res.json();
        setSnapshots((prev) => [
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
    sysinfoRef.current = setInterval(poll, 2000);
    return () => {
      if (sysinfoRef.current) clearInterval(sysinfoRef.current);
    };
  }, []);

  const failJob = (message: string) => {
    setJob({
      id: "run-error",
      status: "failed",
      total: 0,
      current: 0,
      log: [message],
      processedImages: [],
      results: [],
      startedAt: Date.now(),
    });
  };

  const handleRun = async () => {
    if (!selectedFolder || (!mosaicConfig.enabled && !resizeConfig.enabled))
      return;
    setSubmitting(true);
    setJob(null);
    setJobId(null);
    setSyncResult(null);
    setSyncError(null);
    setLogOpen(true);
    try {
      if (localMode) {
        setUploading(true);
        try {
          const uploadRes = await fetch("/api/process/upload-to-remote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: selectedFolder }),
          });
          if (!uploadRes.ok) {
            failJob("リモートへのアップロードに失敗しました");
            return;
          }
        } catch (e) {
          failJob(
            `リモートへのアップロードに失敗しました: ${e instanceof Error ? e.message : String(e)}`,
          );
          return;
        } finally {
          setUploading(false);
        }
      }
      const body: RunRequest = {
        folder: selectedFolder,
        mosaic: mosaicConfig,
        resize: { ...resizeConfig, scalePercent: effectiveScale },
      };
      let data: { jobId?: string; error?: string };
      try {
        const res = await fetch("/api/process/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        data = await res.json();
      } catch (e) {
        failJob(`実行リクエストに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      if (data.jobId) {
        setJobId(data.jobId);
        setJob({
          id: data.jobId,
          status: "pending",
          total: 0,
          current: 0,
          log: [],
          processedImages: [],
          results: [],
          startedAt: Date.now(),
        });
      } else {
        failJob(data.error ?? "実行に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async () => {
    if (!selectedFolder || !jobId?.startsWith("remote:")) return;
    const sub = mosaicConfig.enabled ? "mosaic" : "resized";
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/process/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, sub }),
      });
      const data = await res.json();
      if (res.ok) setSyncResult(data);
      else setSyncError(data.error ?? "ローカルフォルダへの保存に失敗しました");
    } catch (e) {
      setSyncError(`ローカルフォルダへの保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const isRunning = job?.status === "running" || job?.status === "pending";
  const selectedFolderInfo = folders.find((f) => f.name === selectedFolder);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppHeader active="process" />

      <div className="flex min-h-0 flex-1 gap-0">
        <div className="flex w-160 shrink-0 flex-col border-r">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <Label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    処理対象フォルダ
                  </Label>
                  <div className="ml-auto flex gap-0.5 rounded border p-0.5">
                    <button
                      onClick={() => setLocalMode(false)}
                      className={`rounded px-2 py-0.5 text-[11px] transition-colors ${!localMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      リモート
                    </button>
                    <button
                      onClick={() => setLocalMode(true)}
                      className={`rounded px-2 py-0.5 text-[11px] transition-colors ${localMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      ローカル
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    loadDirs();
                    setPickerOpen(true);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/50 ${
                    selectedFolder
                      ? "border-border bg-card/30"
                      : "border-dashed border-border"
                  }`}
                >
                  {selectedFolderInfo?.firstImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrl(selectedFolderInfo.firstImage)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted/50">
                      <FolderOpen className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {selectedFolder ? (
                      <>
                        <p className="truncate font-mono text-xs font-medium">
                          {selectedFolder}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {selectedFolderInfo?.count ?? "?"} 枚
                          {estimate
                            ? ` · ${fmtBytes(estimate.currentBytes)}`
                            : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        クリックして選択...
                      </p>
                    )}
                  </div>
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>

              <Separator />

              <ConfigSection
                title="リサイズ / 圧縮"
                enabled={resizeConfig.enabled}
                onToggle={(v) => setResizeConfig((c) => ({ ...c, enabled: v }))}
              >
                <ResizeConfig
                  config={resizeConfig}
                  onChange={setResizeConfig}
                  estimate={resizeConfig.enabled ? estimate : null}
                />
              </ConfigSection>

              <ConfigSection
                title="自動モザイク"
                enabled={mosaicConfig.enabled}
                onToggle={(v) => setMosaicConfig((c) => ({ ...c, enabled: v }))}
              >
                <MosaicConfig
                  config={mosaicConfig}
                  onChange={setMosaicConfig}
                />
              </ConfigSection>

              {resizeConfig.enabled && mosaicConfig.enabled && (
                <p className="text-[11px] text-muted-foreground rounded border border-border bg-muted/30 px-2 py-1.5">
                  リサイズ → モザイクの順で実行（先に縮小して I/O
                  を削減）。出力先:{" "}
                  <span className="font-mono">
                    {selectedFolder || "…"}/mosaic/
                  </span>
                </p>
              )}
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t p-3">
            {estimate && estimatedFinalBytes !== null && (
              <Alert className="mb-2">
                <Info />
                <AlertTitle>出力サイズの目安</AlertTitle>
                <AlertDescription>
                  現在 {fmtBytes(estimate.currentBytes)} ({estimate.count}枚) →
                  約 {fmtBytes(estimatedFinalBytes)}
                  {resizeConfig.convertFormat === "jpg" && "（JPEG変換込み）"}
                </AlertDescription>
              </Alert>
            )}
            <Button
              className="w-full gap-2"
              disabled={
                !selectedFolder ||
                (!mosaicConfig.enabled && !resizeConfig.enabled) ||
                isRunning ||
                submitting
              }
              onClick={handleRun}
            >
              {isRunning || submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {uploading
                ? "アップロード中..."
                : isRunning || submitting
                  ? "処理中..."
                  : "処理を開始"}
            </Button>
            {!mosaicConfig.enabled && !resizeConfig.enabled && (
              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                モザイクかリサイズを有効にしてください
              </p>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <ResourceMonitor snapshots={snapshots} />
          <ScrollArea className="flex-1 p-4">
            {!job ? (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    処理を開始するとここに進捗が表示されます
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    出力先:{" "}
                    <span className="font-mono">
                      {selectedFolder || "…"}/mosaic/
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <>
                <JobProgress
                  job={job}
                  logOpen={logOpen}
                  onToggleLog={() => setLogOpen((v) => !v)}
                />

                {job.status === "completed" && (
                  <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 space-y-2">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      処理が完了しました
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      出力先:{" "}
                      <span className="font-mono">
                        {selectedFolder}/
                        {mosaicConfig.enabled ? "mosaic" : "resized"}/
                      </span>
                    </p>
                    {jobId?.startsWith("remote:") && !syncResult && (
                      <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="inline-flex items-center gap-1.5 rounded-md border border-green-600/40 bg-green-600/10 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-600/20 dark:text-green-300 transition-colors disabled:opacity-50"
                      >
                        {syncing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        {syncing ? "保存中..." : "ローカルフォルダに保存"}
                      </button>
                    )}
                    {syncError && (
                      <p className="rounded border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                        {syncError}
                      </p>
                    )}
                    {syncResult && (
                      <div className="rounded border border-border bg-muted/30 px-2.5 py-2 text-[11px] space-y-0.5">
                        <p className="font-medium text-foreground">
                          保存完了: {syncResult.saved} 枚
                          {syncResult.skipped > 0 && (
                            <span className="ml-1 text-muted-foreground">
                              (スキップ {syncResult.skipped} 枚)
                            </span>
                          )}
                        </p>
                        <p className="font-mono text-muted-foreground break-all">
                          {syncResult.localPath}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <BeforeAfterGallery
                  folder={selectedFolder}
                  processedImages={job.processedImages}
                  hasMosaic={mosaicConfig.enabled}
                  hasResize={resizeConfig.enabled}
                  cacheBust={job.startedAt}
                />
              </>
            )}
          </ScrollArea>
        </div>
      </div>

      <FolderPickerModal
        open={pickerOpen}
        folders={folders}
        selected={selectedFolder}
        loading={loadingDirs}
        onRefresh={loadDirs}
        onSelect={setSelectedFolder}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
