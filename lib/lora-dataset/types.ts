export type DanbooruRating = "g" | "s" | "q" | "e";

export type TagCategory = "general" | "character" | "copyright" | "artist" | "meta";

export const TAG_CATEGORIES: TagCategory[] = [
  "general",
  "character",
  "copyright",
  "artist",
  "meta",
];

export const DEFAULT_INCLUDE_CATEGORIES: TagCategory[] = ["general", "character"];

/** Image formats accepted into a dataset (video/ugoira posts are rejected). */
export const ALLOWED_IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

export interface DanbooruPostTags {
  general: string[];
  character: string[];
  copyright: string[];
  artist: string[];
  meta: string[];
}

/** Normalized Danbooru posts.json entry (see lib/lora-dataset/danbooru-client.ts). */
export interface DanbooruPost {
  id: number;
  fileUrl: string | null;
  previewUrl: string | null;
  fileExt: string;
  rating: DanbooruRating;
  width: number;
  height: number;
  source: string;
  tags: DanbooruPostTags;
  /** false when fileUrl is missing (Gold-only/deleted) or fileExt isn't an allowed image type. */
  available: boolean;
}

/** Sidecar "_dataset.json" content at the root of "<repeat>_<name>/". */
export interface DatasetMeta {
  name: string;
  repeat: number;
  triggerWord: string;
  includeCategories: TagCategory[];
  createdAt: number;
}

export interface DatasetInfo extends DatasetMeta {
  /** Directory name "<repeat>_<name>", also used as the folder identifier in the API. */
  folder: string;
  imageCount: number;
}

/** Sidecar "<danbooruId>.json" saved next to each image, snapshot of the post at add-time. */
export interface DatasetImageManifest {
  danbooruId: number;
  source: string;
  rating: DanbooruRating;
  fileExt: string;
  tags: DanbooruPostTags;
  /** Tags excluded from the generated caption despite passing includeCategories. */
  removedTags: string[];
  /** Tags added to the caption that weren't part of the original Danbooru tag set. */
  extraTags: string[];
  addedAt: number;
}

export interface DatasetImageEntry {
  id: number;
  filename: string;
  manifest: DatasetImageManifest;
  /** Generated ".txt" caption content (includeCategories filter -> removedTags -> extraTags). */
  caption: string;
}
