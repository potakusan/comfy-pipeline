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
  const withoutRev = stem.replace(/_rev_\d+$/, "");
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
