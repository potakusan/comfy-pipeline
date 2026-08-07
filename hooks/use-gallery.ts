"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { buildWorkflow } from "@/lib/comfy";
import { buildCoupleWorkflow, buildColorMaskWorkflow } from "@/lib/couple";
import {
  submitPromptHttp,
  listOutputFiles,
  pollForCompletion,
} from "@/lib/comfy-client";
import { useComfyWS } from "@/hooks/use-comfy-ws";
import { lsGet, lsSet } from "@/hooks/ls";
import {
  LS_GROUP_BY_POSE,
  DEFAULT_PROMPT_WINDOW_POS,
  type FloatingWindowPos,
  type GalleryFolderInfo,
  type GalleryImageEntry,
  type ImageMetadata,
} from "@/lib/gallery";

const LS_PROMPT_WINDOW_POS = "cp_gallery_prompt_window";
const LS_REGEN_WINDOW_POS = "cp_gallery_regen_window";
const DEFAULT_REGEN_WINDOW_POS: FloatingWindowPos = { x: -1, y: -1, collapsed: false };

export function useGallery() {
  const [clientId] = useState(() => crypto.randomUUID());
  const [folders, setFolders] = useState<GalleryFolderInfo[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const [images, setImages] = useState<GalleryImageEntry[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showReleasedOnly, setShowReleasedOnly] = useState(false);

  const [groupByPose, setGroupByPoseState] = useState(false);
  useEffect(() => {
    setGroupByPoseState(lsGet(LS_GROUP_BY_POSE, false));
  }, []);
  const setGroupByPose = useCallback((v: boolean) => {
    setGroupByPoseState(v);
    lsSet(LS_GROUP_BY_POSE, v);
  }, []);

  const [promptWindowPos, setPromptWindowPosState] = useState<FloatingWindowPos>(
    DEFAULT_PROMPT_WINDOW_POS,
  );
  useEffect(() => {
    setPromptWindowPosState(lsGet(LS_PROMPT_WINDOW_POS, DEFAULT_PROMPT_WINDOW_POS));
  }, []);
  const setPromptWindowPos = useCallback((pos: FloatingWindowPos) => {
    setPromptWindowPosState(pos);
    lsSet(LS_PROMPT_WINDOW_POS, pos);
  }, []);

  const [regenWindowPos, setRegenWindowPosState] = useState<FloatingWindowPos>(
    DEFAULT_REGEN_WINDOW_POS,
  );
  useEffect(() => {
    setRegenWindowPosState(lsGet(LS_REGEN_WINDOW_POS, DEFAULT_REGEN_WINDOW_POS));
  }, []);
  const setRegenWindowPos = useCallback((pos: FloatingWindowPos) => {
    setRegenWindowPosState(pos);
    lsSet(LS_REGEN_WINDOW_POS, pos);
  }, []);

  const visibleImages = useMemo(
    () => (showReleasedOnly ? images.filter((i) => i.releasePath) : images),
    [images, showReleasedOnly],
  );

  // Keep selectedIndex in range whenever the visible list shrinks (filter
  // toggled, image deleted, etc.) — never grows it back on its own.
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, visibleImages.length - 1)));
  }, [visibleImages.length]);

  const [regenerating, setRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState({ value: 0, max: 0 });
  const [regenPreviewUrl, setRegenPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const redoRequestedRef = useRef(false);

  useComfyWS(clientId, {
    onProgress: (value, max) => setRegenProgress({ value, max }),
    onPreview: (url) => setRegenPreviewUrl(url),
  });

  const refreshFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const res = await fetch("/api/gallery/folders");
      const data = await res.json();
      setFolders((data.dirs || []) as GalleryFolderInfo[]);
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  const refreshImages = useCallback(async (folder: string): Promise<GalleryImageEntry[]> => {
    setImagesLoading(true);
    try {
      const res = await fetch(`/api/gallery/images?folder=${encodeURIComponent(folder)}`);
      const data = await res.json();
      const list = (data.images || []) as GalleryImageEntry[];
      setImages(list);
      return list;
    } finally {
      setImagesLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  const selectFolder = useCallback(
    (folder: string) => {
      setSelectedFolder(folder);
      setSelectedIndex(0);
      refreshImages(folder);
    },
    [refreshImages],
  );

  const toggleRelease = useCallback(
    async (entry: GalleryImageEntry) => {
      const wasReleased = !!entry.releasePath;
      const method = wasReleased ? "DELETE" : "POST";
      try {
        const res = await fetch("/api/gallery/release", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: [entry.path] }),
        });
        const data = await res.json().catch(() => ({}));
        const count = wasReleased ? data.removed : data.copied;
        if (!res.ok || count !== 1) {
          setError(
            `${wasReleased ? "販売用フォルダからの削除" : "販売用フォルダへのコピー"}に失敗しました: ${entry.filename}`,
          );
        } else {
          setError(null);
        }
      } catch {
        setError("販売用フォルダの更新に失敗しました（サーバーに接続できません）");
      }
      if (selectedFolder) await refreshImages(selectedFolder);
      await refreshFolders();
    },
    [selectedFolder, refreshImages, refreshFolders],
  );

  const deleteImage = useCallback(
    async (entry: GalleryImageEntry) => {
      await fetch("/api/gallery/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: entry.path }),
      }).catch(() => {});
      if (selectedFolder) await refreshImages(selectedFolder);
      await refreshFolders();
      setSelectedIndex((i) => Math.max(0, i - 1));
    },
    [selectedFolder, refreshImages, refreshFolders],
  );

  // Runs one generation attempt for `entry` with a fresh random seed. On
  // cancel (AbortController aborted) it either stops cleanly or, if a redo
  // was requested via redoRegenerate(), loops back and tries again with yet
  // another seed — mirrors the main queue's redoModeRef pattern in
  // hooks/use-pipeline.ts.
  const regenerateImage = useCallback(
    async (
      entry: GalleryImageEntry,
      overrides?: { positivePrompt?: string; negativePrompt?: string },
    ) => {
      if (regenerating) return;
      const sourceSettings = entry.meta?.settings;
      if (!entry.meta || !sourceSettings) {
        setError("この画像にはプロンプト情報が保存されていないため再生成できません");
        return;
      }
      const folder = entry.path.split("/")[0];
      const meta = entry.meta;
      const positivePrompt = overrides?.positivePrompt ?? meta.positivePrompt;
      const negativePrompt = overrides?.negativePrompt ?? meta.negativePrompt ?? "";
      const sourceBase = entry.filename.slice(
        0,
        entry.filename.length - (entry.filename.match(/\.[^.]+$/)?.[0].length ?? 0),
      );
      const outputPrefix = `${folder}/__regen_${sourceBase}`;

      setRegenerating(true);
      setError(null);

      let attempting = true;
      while (attempting) {
        attempting = false;
        redoRequestedRef.current = false;
        setRegenProgress({ value: 0, max: 0 });
        setRegenPreviewUrl(null);

        const newSeed = Math.floor(Math.random() * 2 ** 32);
        const settings = { ...sourceSettings, randomizeSeed: false, seed: newSeed };
        const workflowArgs = {
          settings,
          loras: meta.loras ?? [],
          positivePrompt,
          negativePrompt,
          outputPrefix,
        };

        const abortController = new AbortController();
        abortRef.current = abortController;

        try {
          // buildColorMaskWorkflowはregionsが空だと例外を投げるため、
          // このtry内で構築してcatch側のエラー表示に載せる
          const workflow =
            meta.mode === "colorMask"
              ? buildColorMaskWorkflow({
                  ...workflowArgs,
                  basePositivePrompt: positivePrompt,
                  regions: meta.colorMaskRegions ?? [],
                  controlNet: meta.colorMaskControlNet!,
                })
              : meta.mode === "couple"
                ? buildCoupleWorkflow(workflowArgs)
                : buildWorkflow(workflowArgs);

          const filesBefore = await listOutputFiles(folder);
          const promptId = await submitPromptHttp(workflow, clientId, abortController.signal);
          await pollForCompletion(promptId, abortController.signal);
          const filesAfter = await listOutputFiles(folder);
          const newFiles = filesAfter.filter((f) => !filesBefore.includes(f));
          if (newFiles.length === 0) throw new Error("生成された画像が見つかりませんでした");

          // In remote mode the file was just written on the remote machine's
          // disk — pull it down to local COMFYUI_OUTPUT_DIR before finalizing,
          // mirroring the main queue's flow in hooks/use-pipeline.ts.
          await fetch("/api/comfy/output/save-remote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paths: [`${folder}/${newFiles[0]}`] }),
          }).catch(() => {});

          const newMetadata: ImageMetadata = {
            ...meta,
            settings,
            positivePrompt,
            negativePrompt,
            createdAt: Date.now(),
          };
          const res = await fetch("/api/gallery/finalize-revision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folder,
              tempFilename: newFiles[0],
              sourceFilename: entry.filename,
              metadata: newMetadata,
            }),
          });
          if (!res.ok) throw new Error("再生成後の保存に失敗しました");
          const { filename: newFilename } = (await res.json()) as { filename: string };

          const newList = await refreshImages(folder);
          await refreshFolders();
          const newVisible = showReleasedOnly ? newList.filter((i) => i.releasePath) : newList;
          const idx = newVisible.findIndex((i) => i.filename === newFilename);
          if (idx >= 0) setSelectedIndex(idx);
        } catch (e) {
          const msg = (e as Error).message;
          if (msg === "Cancelled" && redoRequestedRef.current) {
            attempting = true; // loop back with a fresh seed
          } else if (msg !== "Cancelled") {
            setError(msg);
          }
        }
      }

      setRegenerating(false);
      setRegenPreviewUrl(null);
      abortRef.current = null;
    },
    [clientId, regenerating, refreshImages, refreshFolders, showReleasedOnly],
  );

  const cancelRegenerate = useCallback(async () => {
    if (!abortRef.current) return;
    redoRequestedRef.current = false;
    abortRef.current.abort();
    await fetch("/api/comfy/interrupt", { method: "POST" }).catch(() => {});
  }, []);

  const redoRegenerate = useCallback(async () => {
    if (!abortRef.current) return;
    redoRequestedRef.current = true;
    abortRef.current.abort();
    await fetch("/api/comfy/interrupt", { method: "POST" }).catch(() => {});
  }, []);

  return {
    folders,
    foldersLoading,
    selectedFolder,
    selectFolder,
    refreshFolders,
    images,
    visibleImages,
    imagesLoading,
    selectedIndex,
    setSelectedIndex,
    showReleasedOnly,
    setShowReleasedOnly,
    groupByPose,
    setGroupByPose,
    promptWindowPos,
    setPromptWindowPos,
    regenWindowPos,
    setRegenWindowPos,
    toggleRelease,
    deleteImage,
    regenerateImage,
    cancelRegenerate,
    redoRegenerate,
    regenerating,
    regenProgress,
    regenPreviewUrl,
    error,
  };
}
