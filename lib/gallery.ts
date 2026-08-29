import type { GenerationSettings, LoraEntry } from "./comfy";
import type { CoupleControlNet, CoupleRegion } from "./comfy/couple";

/** Which workflow builder produced this image — needed to regenerate it correctly. */
export type GenerationMode = "normal" | "couple" | "colorMask";

/**
 * Sidecar JSON content, saved next to each output image as
 * "<filename>.json" (e.g. out_00001_.png -> out_00001_.png.json).
 * This is the persistence layer for prompt/seed metadata — there is no DB.
 */
export interface ImageMetadata {
  mode: GenerationMode;
  loraName: string;
  positivePrompt: string;
  negativePrompt?: string;
  settings?: GenerationSettings;
  loras?: LoraEntry[];
  queueLabel: string;
  createdAt: number;
  appliedAdditional?: string;
  /** Only set when mode === "colorMask" */
  colorMaskControlNet?: CoupleControlNet;
  colorMaskRegions?: CoupleRegion[];
  /** Set when this image was produced by the gallery "regenerate with new seed" action. */
  revisionOf?: string;
  /** BatchPreset.id this image was generated from (一括キュー実行時のみ). Used to aggregate per-preset release rate. */
  batchPresetId?: string;
  /** positivePromptのうち、可変LoRA・固定LoRA・身体的特徴プリセット由来の部分を除いた
   * 残り(人数/ポーズ/シーン/その他プリセットの実際に使われたテキスト+追加プロンプト+
   * バリエーションタグ、生成時点で解決済みのもの)。シード引き継ぎ実行時、可変LoRA/
   * 身体的特徴だけ選び直してこの部分はそのまま再利用する(buildReusablePromptSegment参照)。 */
  reusablePromptSuffix?: string;
  /** reusablePromptSuffixに対応する、人数/ポーズ/シーン/その他プリセット由来のLoRA一覧。
   * シード引き継ぎ実行時、可変LoRA/身体的特徴のLoRAは選び直すが、これらは一緒に再利用する。 */
  reusableLoras?: LoraEntry[];
}

export interface GalleryFolderInfo {
  name: string;
  count: number;
  /** path relative to outputDir, usable with /api/comfy/output/thumbnail?path= */
  firstImage: string | null;
  releaseCount: number;
  /** number of images in "<folder>/mosaic/" (automosaic.py output), 0 if none */
  mosaicCount: number;
}

export interface GalleryImageEntry {
  filename: string;
  /** path relative to outputDir */
  path: string;
  /** path relative to outputDir of the copy in "<folder>_release/", if selected for release */
  releasePath: string | null;
  meta: ImageMetadata | null;
}

/** An image inside "<folder>/mosaic/" — automosaic.py output, no sidecar metadata/release. */
export interface GalleryMosaicImageEntry {
  filename: string;
  /** path relative to outputDir, e.g. "20240101-x/mosaic/out_00001__mosaic.png" */
  path: string;
}

export function releaseFolderName(folder: string): string {
  return `${folder}_release`;
}

/**
 * Extracts a stable "pose" grouping key from a generated image's filename by
 * stripping ComfyUI's own numeric counter suffix (and any "_rev_NNNN"
 * regenerate-revision suffix), leaving the batch/preset prefix shared by
 * every image from the same pose/preset run (e.g. "1_2_1 reverse").
 */
export function getPoseGroup(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  // 同じ画像をさらに再生成すると"_rev_0001_rev_0002"のように_rev_NNNNが
  // 連続することがあるため、末尾から繰り返し全て剥がす(1回だけだと
  // 内側の_rev_NNNNが残りグルーピングが壊れる)。
  const withoutRev = stem.replace(/(?:_rev_\d+)+$/, "");
  const withoutCounter = withoutRev.replace(/_\d{5}_?$/, "");
  return (withoutCounter || withoutRev || stem).replace(/_+$/, "") || stem;
}

/** localStorage key for the gallery thumbnail list's "group by pose" toggle (also round-tripped through the app's settings export/import). */
export const LS_GROUP_BY_POSE = "cp_gallery_group_by_pose";

export interface FloatingWindowPos {
  x: number;
  y: number;
  collapsed: boolean;
  width?: number;
  height?: number;
}

export const DEFAULT_PROMPT_WINDOW_POS: FloatingWindowPos = { x: -1, y: -1, collapsed: false };
