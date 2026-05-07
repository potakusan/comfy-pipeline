import { FIXED_POSITIVE_PREFIX } from "./config";

export interface LoraEntry {
  name: string;
  strength: number;
  clipStrength: number;
  triggerWords: string;
}

export interface GenerationSettings {
  checkpoint: string;
  upscaleModel: string;
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
  createdAt: number;
  batchPresets: QueueItemBatchPresets;
}

export interface SizePreset {
  label: string;
  width: number;
  height: number;
}

export const SIZE_PRESETS: SizePreset[] = [
  { label: "横長", width: 1536, height: 1136 },
  { label: "正方形", width: 1024, height: 1024 },
  { label: "4:3", width: 1536, height: 1152 },
  { label: "3:4", width: 1152, height: 1536 },
  { label: "縦長", width: 960, height: 1600 },
];

export const DEFAULT_COMPOSITION_TAGS = [
  "from above,",
  "from below,",
  "from behind,",
  "dutch angle,",
  "close-up, upper body,",
  "full body,",
  "wide shot,",
];

export interface BatchPreset {
  id: string;
  name: string;
  physicalPresets: Preset[];
  countPreset: Preset | null;
  posePreset: Preset | null;
  scenePreset: Preset | null;
  otherPresets: Preset[];
  additionalPrompt: string;
  additionalPromptMode: "all" | "random";
  settings: GenerationSettings;
  variationEnabled: boolean;
  variationTags: string[];
  batchCount: number;
}

export interface BatchPresetSet {
  id: string;
  name: string;
  presets: BatchPreset[];
}

export interface GalleryImage {
  /** Path relative to COMFYUI_OUTPUT_DIR, e.g. "20240101-loraname/out_00001_.png" */
  path: string;
  loraName: string;
  positivePrompt: string;
  queueLabel: string;
  createdAt: number;
  /** The actual additional prompt applied to this image (recorded for random mode) */
  appliedAdditional?: string;
}

export const DEFAULT_PHYSICAL_PRESETS: Preset[] = [];

export const DEFAULT_SCENE_PRESETS: Preset[] = [
  {
    id: "scene-casino",
    name: "カジノ",
    prompt:
      "casino, poker chips, table, roulette table, playing cards,\nsimple background, blurry background,",
    type: "scene",
  },
  {
    id: "scene-hotel",
    name: "ホテルルーム",
    prompt: "indoors, bed, hotel room,\nwhite bed sheet,\nsimple background,",
    type: "scene",
  },
];

export const DEFAULT_COUNT_PRESETS: Preset[] = [
  { id: "count-1", name: "1人", prompt: "solo, solo focus,", type: "count" },
  { id: "count-2", name: "2人", prompt: "2girls,", type: "count" },
  { id: "count-3p", name: "3人以上", prompt: "3girls,", type: "count" },
];

export const DEFAULT_POSE_PRESETS: Preset[] = [
  {
    id: "pose-cowgirl",
    name: "カウガール",
    prompt:
      "cowgirl position, leaning forward,\nfrom below, pov,\nmotion lines,",
    type: "pose",
  },
  {
    id: "pose-mlegs",
    name: "M字開脚",
    prompt: "m legs, pussy peek,\nfrom below,",
    type: "pose",
  },
];

export const DEFAULT_OTHER_PRESETS: Preset[] = [
  { id: "other-blush", name: "blush", prompt: "blush,", type: "other" },
  {
    id: "other-embarrassed",
    name: "embarrassed",
    prompt: "embarrassed,",
    type: "other",
  },
];

export const SAMPLER_OPTIONS = [
  "euler",
  "euler_ancestral",
  "heun",
  "dpm_2",
  "dpm_2_ancestral",
  "lms",
  "dpm_fast",
  "dpm_adaptive",
  "dpmpp_2s_ancestral",
  "dpmpp_sde",
  "dpmpp_sde_gpu",
  "dpmpp_2m",
  "dpmpp_2m_sde",
  "dpmpp_2m_sde_gpu",
  "dpmpp_3m_sde",
  "dpmpp_3m_sde_gpu",
  "ddim",
  "uni_pc",
  "uni_pc_bh2",
];

export const SCHEDULER_OPTIONS = [
  "normal",
  "karras",
  "exponential",
  "sgm_uniform",
  "simple",
  "ddim_uniform",
];

export function buildOutputPrefix(loraName: string): string {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const safeName = (loraName || "no-lora")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 40);
  return `${dateStr}-${safeName}/out`;
}

function pushPreset(parts: string[], preset: Preset) {
  if (preset.prompt.trim()) parts.push(preset.prompt);
  if (preset.lora?.triggerWords?.trim())
    parts.push(preset.lora.triggerWords.trim());
}

export function assemblePositivePrompt({
  variableLora,
  selectedPhysicalPresets,
  selectedCountPreset,
  selectedPosePreset,
  selectedScenePreset,
  selectedOtherPresets,
  additionalPrompt,
}: {
  variableLora: LoraEntry | null;
  selectedPhysicalPresets: Preset[];
  selectedCountPreset: Preset | null;
  selectedPosePreset: Preset | null;
  selectedScenePreset: Preset | null;
  selectedOtherPresets: Preset[];
  additionalPrompt: string;
}): string {
  const parts: string[] = [FIXED_POSITIVE_PREFIX];

  if (variableLora?.triggerWords?.trim()) {
    parts.push(variableLora.triggerWords.trim());
  }

  for (const p of selectedPhysicalPresets) pushPreset(parts, p);
  if (selectedCountPreset) pushPreset(parts, selectedCountPreset);
  if (selectedPosePreset) pushPreset(parts, selectedPosePreset);
  if (selectedScenePreset) pushPreset(parts, selectedScenePreset);
  for (const p of selectedOtherPresets) pushPreset(parts, p);

  if (additionalPrompt.trim()) {
    parts.push(additionalPrompt.trim());
  }

  return parts.join("\n\n");
}

export function collectPresetLoras(presets: Preset[]): LoraEntry[] {
  return presets.flatMap((p) => (p.lora ? [p.lora] : []));
}

type NodeRef = [string, number];

export function buildWorkflow({
  settings,
  loras,
  positivePrompt,
  negativePrompt,
  outputPrefix,
}: {
  settings: GenerationSettings;
  loras: LoraEntry[];
  positivePrompt: string;
  negativePrompt: string;
  outputPrefix: string;
}): Record<string, unknown> {
  const wf: Record<string, unknown> = {};

  wf["chk"] = {
    inputs: { ckpt_name: settings.checkpoint },
    class_type: "CheckpointLoaderSimple",
  };

  wf["upm"] = {
    inputs: { model_name: settings.upscaleModel },
    class_type: "UpscaleModelLoader",
  };

  wf["lat"] = {
    inputs: { width: settings.width, height: settings.height, batch_size: 1 },
    class_type: "EmptyLatentImage",
  };

  let lastModel: NodeRef = ["chk", 0];
  let lastClip: NodeRef = ["chk", 1];

  loras.forEach((lora, i) => {
    const id = `lora${i}`;
    const loraName = lora.name.endsWith(".safetensors")
      ? lora.name
      : `${lora.name}.safetensors`;
    wf[id] = {
      inputs: {
        lora_name: loraName,
        strength_model: lora.strength,
        strength_clip: lora.clipStrength,
        model: lastModel,
        clip: lastClip,
      },
      class_type: "LoraLoader",
    };
    lastModel = [id, 0];
    lastClip = [id, 1];
  });

  wf["pos"] = {
    inputs: { text: positivePrompt, clip: lastClip },
    class_type: "CLIPTextEncode",
  };

  wf["neg"] = {
    inputs: { text: negativePrompt, clip: lastClip },
    class_type: "CLIPTextEncode",
  };

  const seed = settings.randomizeSeed
    ? Math.floor(Math.random() * 2 ** 32)
    : settings.seed;

  wf["ksamp"] = {
    inputs: {
      seed,
      steps: settings.steps,
      cfg: settings.cfg,
      sampler_name: settings.sampler,
      scheduler: settings.scheduler,
      denoise: settings.denoise,
      model: lastModel,
      positive: ["pos", 0],
      negative: ["neg", 0],
      latent_image: ["lat", 0],
    },
    class_type: "KSampler",
  };

  wf["vae"] = {
    inputs: { samples: ["ksamp", 0], vae: ["chk", 2] },
    class_type: "VAEDecode",
  };

  wf["upi"] = {
    inputs: { upscale_model: ["upm", 0], image: ["vae", 0] },
    class_type: "ImageUpscaleWithModel",
  };

  wf["save"] = {
    inputs: { filename_prefix: outputPrefix, images: ["upi", 0] },
    class_type: "SaveImage",
  };

  return wf;
}
