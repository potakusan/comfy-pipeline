import type { Preset, SizePreset } from "./comfy-types";

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
