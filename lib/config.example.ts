import { GenerationSettings, LoraEntry } from "./comfy";

export const FIXED_LORAS: LoraEntry[] = [
  {
    name: "lora-name",
    strength: 1,
    clipStrength: 1,
    triggerWords: "",
  },
];

export const FIXED_POSITIVE_PREFIX = ``;

export const DEFAULT_NEGATIVE = ``;

export const DEFAULT_SETTINGS: GenerationSettings = {
  checkpoint: "",
  upscaleModel: "",
  width: 512,
  height: 512,
  randomizeSeed: true,
  seed: 0,
  steps: 48,
  cfg: 3,
  sampler: "",
  scheduler: "",
  denoise: 1,
};
