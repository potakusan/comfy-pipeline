"use client";
import { useState, useRef, useCallback } from "react";
import {
  type BatchRunInfo,
  type SeedRecipeGroup,
  buildMoreGenerationRun,
  buildWorkflow,
} from "@/lib/comfy";
import { useComfyWS } from "@/hooks/use-comfy-ws";
import { submitAndAwaitNewFiles, classifyCancelError } from "@/lib/comfy/comfy-client";
import { buildBatchQueueItems } from "@/hooks/pipeline/build-batch-items";
import { resolveItemBatch } from "@/hooks/pipeline/resolve-batch";
import { saveBatchImages } from "@/hooks/pipeline/save-batch-images";

export type MoreGenerationPhase = "idle" | "running" | "done";

export interface MoreGenerationTarget {
  group: SeedRecipeGroup;
  /** 保存先のギャラリーフォルダ(ComfyUI出力のサブフォルダ) */
  folder: string;
  /** 既存画像と同じファイル名接頭辞。ComfyUIの連番(_NNNNN_)はこの接頭辞ごとに続きから振られる */
  prefix: string;
}

/**
 * ギャラリーのポーズ別集計から、保存済みレシピを使って同じ構成のまま n 枚追加生成する。
 * ランダム部分は1枚ごとに引き直し、保存先は既存画像と同じフォルダ・同じ接頭辞(連番は続き)。
 *
 * @param onImageSaved 1枚保存するたびに呼ばれる(ギャラリー一覧の更新用。メタデータ保存完了後)
 */
export function useMoreGeneration(onImageSaved: (path: string) => void | Promise<void>) {
  const [clientId] = useState(() => crypto.randomUUID());
  const [phase, setPhase] = useState<MoreGenerationPhase>("idle");
  const [total, setTotal] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const [discarded, setDiscarded] = useState(0);
  const [progress, setProgress] = useState({ value: 0, max: 0 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const redoRef = useRef(false);
  const stopRef = useRef(false);
  const onImageSavedRef = useRef(onImageSaved);
  onImageSavedRef.current = onImageSaved;

  useComfyWS(clientId, {
    onProgress: (value, max) => setProgress({ value, max }),
    onPreview: (url) => setPreviewUrl(url),
  });

  const interrupt = useCallback(async () => {
    abortRef.current?.abort();
    await fetch("/api/comfy/interrupt", { method: "POST" }).catch(() => {});
  }, []);

  /** 生成中の1枚を破棄して、ランダム部分と seed を引き直して同じ枚数目をやり直す */
  const redoCurrent = useCallback(async () => {
    if (!abortRef.current) return;
    redoRef.current = true;
    await interrupt();
  }, [interrupt]);

  /** 残りの生成を打ち切る(生成済みの画像は残る) */
  const stop = useCallback(async () => {
    stopRef.current = true;
    redoRef.current = false;
    await interrupt();
  }, [interrupt]);

  const reset = useCallback(() => {
    setPhase("idle");
    setSaved([]);
    setDiscarded(0);
    setError(null);
    setCancelled(false);
    setProgress({ value: 0, max: 0 });
    setPreviewUrl(null);
  }, []);

  const start = useCallback(
    async (target: MoreGenerationTarget, count: number) => {
      const run = buildMoreGenerationRun(target.group, count);
      if (!run) {
        setError("このレシピには生成設定が保存されていないため生成できません");
        setPhase("done");
        return;
      }
      const batchRun: BatchRunInfo = {
        runId: crypto.randomUUID(),
        setId: run.overrides.batchSet?.id,
        setName: run.overrides.batchSet?.name,
        startedAt: Date.now(),
      };
      const fixedLoras = target.group.recipe.fixedLoras;
      const [item] = buildBatchQueueItems(run.presets, run.overrides, batchRun, {
        countPresets: [],
        posePresets: [],
        otherPresets: [],
        fixedTags: "",
        fixedLoras,
        variableDefs: {},
        adetailer: [],
      });
      const n = item.batchCount;
      const outputPrefix = `${target.folder}/${target.prefix}`;

      stopRef.current = false;
      redoRef.current = false;
      setSaved([]);
      setDiscarded(0);
      setError(null);
      setCancelled(false);
      setTotal(n);
      setPhase("running");

      outer: for (let i = 0; i < n; i++) {
        for (;;) {
          setProgress({ value: 0, max: 0 });
          setPreviewUrl(null);
          redoRef.current = false;

          const resolved = resolveItemBatch(item, fixedLoras, []);
          const abort = new AbortController();
          abortRef.current = abort;
          try {
            const { workflow, seed, upscaleSeed } = buildWorkflow({
              settings: { ...item.settings, randomizeSeed: true },
              loras: resolved.batchAllLoras,
              positivePrompt: resolved.batchPrompt,
              negativePrompt: item.negativePrompt,
              outputPrefix,
              adetailer: item.adetailer,
            });
            const newFiles = await submitAndAwaitNewFiles(
              workflow,
              target.folder,
              clientId,
              abort.signal,
            );
            if (newFiles.length === 0) throw new Error("生成された画像が見つかりませんでした");

            const { images, persisted } = saveBatchImages(
              item,
              resolved,
              target.folder,
              newFiles,
              { ...item.settings, seed, upscaleSeed: upscaleSeed ?? undefined },
            );
            await persisted;
            setSaved((prev) => [...prev, ...images.map((img) => img.path)]);
            for (const img of images) await onImageSavedRef.current(img.path);
            break;
          } catch (e) {
            const outcome = classifyCancelError(e, redoRef.current);
            if (outcome === "retry") {
              setDiscarded((d) => d + 1);
              continue;
            }
            if (outcome === "cancelled") setCancelled(true);
            else setError((e as Error).message);
            break outer;
          } finally {
            abortRef.current = null;
          }
        }
        if (stopRef.current) {
          setCancelled(true);
          break;
        }
      }

      setPreviewUrl(null);
      setPhase("done");
    },
    [clientId],
  );

  return {
    phase,
    total,
    saved,
    discarded,
    progress,
    previewUrl,
    error,
    cancelled,
    start,
    redoCurrent,
    stop,
    reset,
  };
}
