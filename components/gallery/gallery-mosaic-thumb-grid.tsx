"use client";
import { useRef } from "react";
import type { GalleryMosaicImageEntry } from "@/lib/gallery";

function thumbUrl(path: string, cacheBust: boolean) {
  const url = `/api/comfy/output/thumbnail?path=${encodeURIComponent(path)}`;
  return cacheBust ? `${url}&t=${Date.now()}` : url;
}

export default function GalleryMosaicThumbGrid({
  images,
  selectedPath,
  onSelect,
  justSavedPath,
}: {
  images: GalleryMosaicImageEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** just-overwritten path — forces a fresh thumbnail fetch past the browser's HTTP cache */
  justSavedPath?: string | null;
}) {
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const registerRef = (index: number, el: HTMLButtonElement | null) => {
    if (el) itemRefs.current.set(index, el);
    else itemRefs.current.delete(index);
  };

  if (images.length === 0) {
    return (
      <p className="p-3 text-center text-xs text-muted-foreground">
        モザイク処理済みの画像がありません
      </p>
    );
  }

  // サムネイルにフォーカスがある間は矢印キーで前後の画像へ移動できるようにする。
  // 選択(state)とDOMフォーカスがずれないよう、移動先のボタンへ明示的にfocus()する
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    // GalleryPageのグローバルArrow/Spaceハンドラ(window addEventListener)は
    // selectedMosaicPathのref読み取りが同一tick内では更新前の値のままになりうる
    // ため、念のため伝播も止めて確実に競合を防ぐ
    e.stopPropagation();
    const delta = e.key === "ArrowLeft" ? -1 : 1;
    const nextIndex = Math.min(images.length - 1, Math.max(0, index + delta));
    if (nextIndex === index) return;
    onSelect(images[nextIndex].path);
    itemRefs.current.get(nextIndex)?.focus();
  };

  return (
    <div className="grid grid-cols-3 gap-1.5 overflow-y-auto p-2">
      {images.map((entry, i) => (
        <button
          key={entry.path}
          ref={(el) => registerRef(i, el)}
          onClick={() => onSelect(entry.path)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className={`overflow-hidden rounded border bg-muted/20 transition-all ${
            selectedPath === entry.path
              ? "border-primary ring-1 ring-primary"
              : "border-border hover:border-muted-foreground/50"
          }`}
        >
          <img
            src={thumbUrl(entry.path, entry.path === justSavedPath)}
            alt={entry.filename}
            className="aspect-3/4 w-full object-cover"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}
