export type SysSnapshot = {
  t: number;
  cpu: number;
  gpu: number | null;
  vramPct: number | null;
  vramUsed: number | null;
  vramTotal: number | null;
  gpuName: string | null;
};

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function fmtDuration(secs: number): string {
  if (!isFinite(secs) || secs <= 0) return "—";
  if (secs < 60) return `${Math.round(secs)}秒`;
  if (secs < 3600)
    return `${Math.floor(secs / 60)}分${Math.round(secs % 60)}秒`;
  return `${Math.floor(secs / 3600)}時間${Math.floor((secs % 3600) / 60)}分`;
}

export function thumbUrl(relativePath: string) {
  return `/api/comfy/output/thumbnail?path=${encodeURIComponent(relativePath)}`;
}

/** automosaic.py saves output as {stem}_mosaic{ext} */
export function toMosaicFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return filename + "_mosaic";
  return filename.slice(0, dot) + "_mosaic" + filename.slice(dot);
}

export const DEFAULT_RESIZE = {
  enabled: true,
  scalePercent: 40,
  autoTarget: true,
  targetMB: 100,
  quality: 100,
  convertFormat: "jpg" as "keep" | "png" | "jpg",
  convertQuality: 100,
};

/** Compute scale% so total output ≈ targetMB (pixel-area estimate). */
export function calcAutoScale(currentBytes: number, targetMB: number): number {
  if (currentBytes <= 0) return 100;
  const ratio = (targetMB * 1024 * 1024) / currentBytes;
  return Math.min(100, Math.max(10, Math.round(Math.sqrt(ratio) * 100)));
}

/**
 * JPEG変換時の追加圧縮率(PNG相当を1とした倍率)のおおまかな目安。
 * 実際のファイルサイズは画像内容（線画/写真調、色数など）に強く依存するため、
 * あくまで大まかな傾向を示す経験則。PNG変換/元形式のままの場合は倍率を掛けない。
 */
export function estimateFormatMultiplier(
  format: "keep" | "png" | "jpg",
  quality: number,
): number {
  if (format === "jpg") return 0.15 + (quality / 100) * 0.35;
  return 1;
}
