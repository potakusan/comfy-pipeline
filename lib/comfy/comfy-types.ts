export interface PresetCategory {
  id: string;
  name: string;
}

export interface LoraEntry {
  name: string;
  strength: number;
  clipStrength: number;
  triggerWords: string;
  /** true = 実LoRAファイルを適用せず、プロンプト/フォルダ分け用のタイトルとしてのみ使う */
  isPromptOnly?: boolean;
}

export interface GenerationSettings {
  checkpoint: string;
  upscaleModel: string;
  upscaleSteps: number;
  width: number;
  height: number;
  randomizeSeed: boolean;
  seed: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  denoise: number;
}

export interface Preset {
  id: string;
  name: string;
  prompt: string;
  type: "physical" | "count" | "pose" | "scene" | "other";
  lora?: LoraEntry;
  /** "all" = use full prompt; "random" = pick one random line per generation */
  promptMode?: "all" | "random";
  category?: string; // PresetCategory.id
}

export type PresetType = Preset["type"];

export interface QueueItemBatchPresets {
  selectedPhysicals: Preset[];
  selectedCount: Preset | null;
  selectedPose: Preset | null;
  selectedScene: Preset | null;
  selectedOthers: Preset[];
}

export interface QueueItem {
  id: string;
  label: string;
  variableLora: LoraEntry | null;
  presetLoras: LoraEntry[];
  positivePrompt: string;
  /** assembled WITHOUT additionalPrompt — used as base for random mode */
  positivePromptBase: string;
  negativePrompt: string;
  settings: GenerationSettings;
  batchCount: number;
  status: "pending" | "running" | "completed" | "cancelled" | "failed";
  currentBatch: number;
  completedImages: GalleryImage[];
  variationTags: string[];
  additionalPromptMode: "all" | "random";
  additionalPromptLines: string[];
  /** fixedTags used for random-mode per-batch re-resolution */
  fixedTags: string;
  createdAt: number;
  batchPresets: QueueItemBatchPresets;
  /** When true, uses PCLazyTextEncode workflow for COUPLE prompt syntax */
  coupleWorkflow?: boolean;
  /** When true, uses RegionalConditioningColorMask //Inspire + ControlNet workflow */
  colorMaskWorkflow?: boolean;
  /** ControlNet config used when colorMaskWorkflow is true */
  colorMaskControlNet?: import("./couple").CoupleControlNet;
  /** Region info (colorHex + prompt + lora) used when colorMaskWorkflow is true */
  colorMaskRegions?: import("./couple").CoupleRegion[];
  /** Custom file name prefix (e.g. batch preset name). Replaces "out" in the output path. */
  filePrefix?: string;
}

export interface SizePreset {
  label: string;
  width: number;
  height: number;
}

export interface BatchPreset {
  id: string;
  name: string;
  /** プリセットIDで参照（実行時に最新内容を解決） */
  countPresetId: string | null;
  posePresetId: string | null;
  otherPresetIds: string[];
  additionalPrompt: string;
  additionalPromptMode: "all" | "random";
  /** 固定タグ (プリセット保存) */
  fixedTags: string;
  /** ネガティブプロンプト (プリセット保存) */
  negativePrompt: string;
  variationEnabled: boolean;
  variationTags: string[];
  batchCount: number;
}

/** 一括キュー実行時に手動指定するオーバーライド設定 */
export interface BatchRunOverrides {
  variableLora: LoraEntry | null;
  physicalPresets: Preset[];
  scenePreset: Preset | null;
  settings: GenerationSettings;
}

export interface BatchPresetSet {
  id: string;
  name: string;
  presets: BatchPreset[];
}

export interface GalleryImage {
  /** Unique identifier for this image (UUID assigned at generation time) */
  id?: string;
  /** Path relative to COMFYUI_OUTPUT_DIR, e.g. "20240101-loraname/out_00001_.png" */
  path: string;
  loraName: string;
  positivePrompt: string;
  negativePrompt?: string;
  settings?: GenerationSettings;
  loras?: LoraEntry[];
  queueLabel: string;
  createdAt: number;
  /** The actual additional prompt applied to this image (recorded for random mode) */
  appliedAdditional?: string;
}
