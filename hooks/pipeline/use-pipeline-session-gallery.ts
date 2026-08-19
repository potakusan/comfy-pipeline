"use client";
import { useState, useCallback, useEffect } from "react";
import { type GalleryImage } from "@/lib/comfy";
import { lsGet, lsSet } from "@/hooks/ls";
import type { GalleryImageEntry } from "@/lib/gallery";

const LS_GALLERY = "cp_gallery";

/**
 * セッション内で生成した画像の一覧(このタブでの生成結果プレビュー用)。
 * use-gallery.tsのフォルダ閲覧用ギャラリーとは別概念。
 */
export function usePipelineSessionGallery() {
  const [gallery, setGallery] = useState<GalleryImage[]>(() =>
    lsGet(LS_GALLERY, []),
  );

  useEffect(() => { lsSet(LS_GALLERY, gallery.slice(0, 300)); }, [gallery]);

  const clearGallery = useCallback(() => setGallery([]), []);

  const refreshGalleryFromFs = useCallback(async () => {
    const res = await fetch("/api/comfy/output").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    const dirs = (data.dirs || []) as string[];

    const newImages: GalleryImage[] = [];
    for (const dir of dirs.slice(0, 30)) {
      // /api/gallery/images はファイル名だけでなく<file>.jsonサイドカーの
      // プロンプト/設定メタデータも一緒に返す(use-gallery.tsの読み込みと共通)。
      // 1フォルダの取得が失敗しても他フォルダの表示を止めない(best-effort)
      const entries: GalleryImageEntry[] = await fetch(
        `/api/gallery/images?folder=${encodeURIComponent(dir)}`,
      )
        .then((r) => (r.ok ? r.json() : { images: [] }))
        .then((d) => d.images || [])
        .catch(() => []);

      for (const entry of entries) {
        const meta = entry.meta;
        newImages.push({
          path: entry.path,
          loraName: meta?.loraName ?? dir.replace(/^\d{8}-/, ""),
          positivePrompt: meta?.positivePrompt ?? "",
          negativePrompt: meta?.negativePrompt,
          settings: meta?.settings,
          loras: meta?.loras,
          queueLabel: meta?.queueLabel ?? dir,
          createdAt: meta?.createdAt ?? Date.now(),
          appliedAdditional: meta?.appliedAdditional,
        });
      }
    }

    setGallery(newImages.reverse());
  }, []);

  return { gallery, setGallery, clearGallery, refreshGalleryFromFs };
}
