"use client";
import { useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { getPoseGroup } from "@/lib/gallery";
import type { GalleryImageEntry } from "@/lib/gallery";

function thumbUrl(path: string) {
  return `/api/comfy/output/thumbnail?path=${encodeURIComponent(path)}`;
}

function Thumb({
  entry,
  index,
  isSelected,
  onSelect,
  onToggleRelease,
  registerRef,
}: {
  entry: GalleryImageEntry;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onToggleRelease: (entry: GalleryImageEntry) => void;
  registerRef: (index: number, el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={(el) => registerRef(index, el)}
      onClick={() => onSelect(index)}
      className={`group relative overflow-hidden rounded border bg-muted/20 transition-all ${
        isSelected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-muted-foreground/50"
      }`}
    >
      <img
        src={thumbUrl(entry.path)}
        alt={entry.filename}
        className="aspect-3/4 w-full object-cover"
        loading="lazy"
      />
      <div
        role="checkbox"
        aria-checked={!!entry.releasePath}
        aria-label="販売用に選択"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onToggleRelease(entry);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onToggleRelease(entry);
          }
        }}
        className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded bg-black/50 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        title="販売用に選択"
      >
        <Checkbox checked={!!entry.releasePath} className="pointer-events-none bg-white/80" />
      </div>
      {entry.meta?.revisionOf && (
        <div className="absolute right-1 bottom-1 rounded bg-black/60 px-1 py-0.5 text-[8px] leading-none text-white">
          REV
        </div>
      )}
    </button>
  );
}

export default function GalleryThumbGrid({
  images,
  selectedIndex,
  onSelect,
  onToggleRelease,
  groupByPose = false,
}: {
  images: GalleryImageEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onToggleRelease: (entry: GalleryImageEntry) => void;
  groupByPose?: boolean;
}) {
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const registerRef = (index: number, el: HTMLButtonElement | null) => {
    if (el) itemRefs.current.set(index, el);
    else itemRefs.current.delete(index);
  };

  // Smooth-scroll the selected thumbnail into view whenever selection
  // changes — including jumps triggered from the pose summary panel.
  useEffect(() => {
    itemRefs.current.get(selectedIndex)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedIndex]);

  if (images.length === 0) {
    return (
      <p className="p-3 text-center text-xs text-muted-foreground">
        画像がありません
      </p>
    );
  }

  if (!groupByPose) {
    return (
      <div className="grid grid-cols-3 gap-1.5 overflow-y-auto p-2">
        {images.map((entry, i) => (
          <Thumb
            key={entry.path}
            entry={entry}
            index={i}
            isSelected={i === selectedIndex}
            onSelect={onSelect}
            onToggleRelease={onToggleRelease}
            registerRef={registerRef}
          />
        ))}
      </div>
    );
  }

  const groups = new Map<string, { entry: GalleryImageEntry; index: number }[]>();
  images.forEach((entry, i) => {
    const pose = getPoseGroup(entry.filename);
    if (!groups.has(pose)) groups.set(pose, []);
    groups.get(pose)!.push({ entry, index: i });
  });

  return (
    <div className="overflow-y-auto p-2">
      {Array.from(groups.entries()).map(([pose, items]) => (
        <div key={pose} className="mb-2.5">
          <p className="mb-1 truncate px-0.5 font-mono text-[9px] font-medium text-muted-foreground">
            {pose} ({items.length})
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {items.map(({ entry, index }) => (
              <Thumb
                key={entry.path}
                entry={entry}
                index={index}
                isSelected={index === selectedIndex}
                onSelect={onSelect}
                onToggleRelease={onToggleRelease}
                registerRef={registerRef}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
