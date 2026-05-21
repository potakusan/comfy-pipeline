import type { LoraEntry, GenerationSettings, Preset } from "./comfy";

export const DEFAULT_REGION_HEX_COLORS = [
  "#ff0000",
  "#0000ff",
  "#00ff00",
  "#ff00ff",
  "#ffff00",
] as const;

export interface CoupleRegion {
  id: string;
  name: string;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  prompt: string;
  lora: LoraEntry | null;
  /** Hex color used for RegionalConditioningColorMask when color-mask mode is active */
  colorHex: string;
  /** IDs of presets whose prompts are automatically included in this region's output */
  selectedPresetIds: string[];
}

export interface CoupleControlNet {
  enabled: boolean;
  /** ControlNet model filename for pose (e.g. "CN-posetest_v2_1.safetensors") */
  controlNetModel: string;
  /** ComfyUI input-folder filename for the pose sketch */
  poseImageName: string | null;
  /** ComfyUI input-folder filename for the color-map image */
  colorMapImageName: string | null;
  strength: number;
  startPercent: number;
  endPercent: number;
}

/** Per-region position/layout preset (unique to COUPLE mode) */
export interface CouplePositionPreset {
  id: string;
  name: string;
  regionPrompts: string[]; // one entry per region (by index)
}

export const DEFAULT_CONTROL_NET: CoupleControlNet = {
  enabled: false,
  controlNetModel: "illustriousXL_v10.safetensors",
  poseImageName: null,
  colorMapImageName: null,
  strength: 2.0,
  startPercent: 0,
  endPercent: 0.9,
};

export interface CoupleConfig {
  id: string;
  name: string;
  /** Includes fixedTags + user base content (2girls, etc.) */
  basePrompt: string;
  regions: CoupleRegion[];
  positionPresets: CouplePositionPreset[];
  controlNet: CoupleControlNet;
}

export const REGION_COLORS: readonly {
  bar: string;
  badge: string;
  ring: string;
}[] = [
  {
    bar: "bg-blue-500",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ring: "ring-blue-500",
  },
  {
    bar: "bg-rose-500",
    badge: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    ring: "ring-rose-500",
  },
  {
    bar: "bg-emerald-500",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    ring: "ring-emerald-500",
  },
  {
    bar: "bg-violet-500",
    badge: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    ring: "ring-violet-500",
  },
  {
    bar: "bg-amber-500",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    ring: "ring-amber-500",
  },
] as const;

export const DEFAULT_COUPLE_CONFIG: CoupleConfig = {
  id: "couple-default",
  name: "デフォルト",
  basePrompt: "2girls,",
  regions: [
    {
      id: "region-default-a",
      name: "キャラA",
      xStart: 0,
      xEnd: 0.45,
      yStart: 0,
      yEnd: 1,
      prompt: "1girl,",
      lora: null,
      colorHex: DEFAULT_REGION_HEX_COLORS[0],
      selectedPresetIds: [],
    },
    {
      id: "region-default-b",
      name: "キャラB",
      xStart: 0.55,
      xEnd: 1,
      yStart: 0,
      yEnd: 1,
      prompt: "1girl,",
      lora: null,
      colorHex: DEFAULT_REGION_HEX_COLORS[1],
      selectedPresetIds: [],
    },
  ],
  positionPresets: [
    {
      id: "pos-default-1",
      name: "立ち",
      regionPrompts: ["standing,", "standing,"],
    },
    {
      id: "pos-default-2",
      name: "座り",
      regionPrompts: ["sitting,", "sitting,"],
    },
  ],
  controlNet: { ...DEFAULT_CONTROL_NET },
};

export function buildCouplePrompt({
  fixedTags,
  basePrompt,
  countPrompt,
  scenePrompt,
  regions,
}: {
  fixedTags: string;
  basePrompt: string;
  countPrompt: string;
  scenePrompt: string;
  regions: CoupleRegion[];
}): string {
  const parts: string[] = [];
  if (fixedTags.trim()) parts.push(fixedTags.trim());
  if (basePrompt.trim()) parts.push(basePrompt.trim());
  if (countPrompt.trim()) parts.push(countPrompt.trim());
  if (scenePrompt.trim()) parts.push(scenePrompt.trim());

  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const xStr = `${r.xStart} ${r.xEnd}`;
    const yStr =
      r.yStart !== 0 || r.yEnd !== 1 ? `, ${r.yStart} ${r.yEnd}` : "";
    const triggerWords = r.lora?.triggerWords?.trim() ?? "";
    const regionParts = [r.prompt, triggerWords].filter((s) => s.trim());
    parts.push(`COUPLE(${xStr}${yStr})\n${regionParts.join(",\n")}`);
  }

  return parts.join("\n\n");
}

export function buildCoupleWorkflow({
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

  type NodeRef = [string, number];
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

  // PCLazyTextEncode understands COUPLE() syntax
  wf["pos"] = {
    inputs: { text: positivePrompt, clip: lastClip },
    class_type: "PCLazyTextEncode",
  };
  wf["neg"] = {
    inputs: { text: negativePrompt, clip: lastClip },
    class_type: "PCLazyTextEncode",
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

// ---------------------------------------------------------------------------
// Color-mask workflow (RegionalConditioningColorMask //Inspire + ControlNet)
// ---------------------------------------------------------------------------

/**
 * Returns a copy of the region with selected-preset prompts merged into `prompt`.
 * Pass the result to buildCouplePrompt / buildColorMaskWorkflow so preset
 * selections are reflected in the workflow without mutating stored state.
 */
export function applySelectedPresets(
  region: CoupleRegion,
  allPresets: Preset[],
): CoupleRegion {
  if (!region.selectedPresetIds.length) return region;
  const selected = allPresets.filter((p) =>
    region.selectedPresetIds.includes(p.id),
  );
  const presetText = selected.map((p) => p.prompt).join(",\n");
  return {
    ...region,
    prompt: [region.prompt.trim(), presetText].filter(Boolean).join(",\n"),
  };
}

/** Assembles the prompt text sent to RegionalConditioningColorMask for one region. */
export function buildRegionPrompt(region: CoupleRegion): string {
  const parts = [
    region.prompt.trim(),
    region.lora?.triggerWords?.trim() ?? "",
  ].filter(Boolean);
  return parts.join(",\n");
}

export function buildColorMaskWorkflow({
  settings,
  loras,
  basePositivePrompt,
  negativePrompt,
  regions,
  controlNet,
  outputPrefix,
}: {
  settings: GenerationSettings;
  loras: LoraEntry[];
  basePositivePrompt: string;
  negativePrompt: string;
  regions: CoupleRegion[];
  controlNet: CoupleControlNet;
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

  type NodeRef = [string, number];
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

  // Color map image (shared across all regions)
  const colorMapFile = controlNet.colorMapImageName ?? "color_map.png";
  wf["colormap"] = {
    inputs: { image: colorMapFile, upload: "image" },
    class_type: "LoadImage",
  };

  // Negative prompt
  wf["neg"] = {
    inputs: { text: negativePrompt, clip: lastClip },
    class_type: "CLIPTextEncode",
  };

  // Base positive prompt
  wf["basepos"] = {
    inputs: { text: basePositivePrompt, clip: lastClip },
    class_type: "CLIPTextEncode",
  };

  // Per-region: CreateHookLora (if LoRA) + SetClipHooks + RegionalConditioningColorMask
  const regionCondRefs: NodeRef[] = [];

  regions.forEach((region, i) => {
    const rcmId = `rcm${i}`;
    let clipRef: NodeRef = lastClip;

    if (region.lora) {
      const hookId = `hookLora${i}`;
      const setClipId = `setClip${i}`;
      const loraName = region.lora.name.endsWith(".safetensors")
        ? region.lora.name
        : `${region.lora.name}.safetensors`;
      wf[hookId] = {
        inputs: {
          lora_name: loraName,
          strength_model: region.lora.strength,
          strength_clip: region.lora.clipStrength,
        },
        class_type: "CreateHookLora",
      };
      wf[setClipId] = {
        inputs: {
          clip: lastClip,
          hooks: [hookId, 0],
          schedule_clip: true,
          apply_to_conds: false,
        },
        class_type: "SetClipHooks",
      };
      clipRef = [setClipId, 0];
    }

    wf[rcmId] = {
      inputs: {
        clip: clipRef,
        color_mask: ["colormap", 0],
        mask_color: region.colorHex,
        strength: 1.0,
        set_cond_area: "default",
        prompt: buildRegionPrompt(region),
      },
      class_type: "RegionalConditioningColorMask //Inspire",
    };
    regionCondRefs.push([rcmId, 0]);
  });

  // Combine regional conditionings (chain of ConditioningCombine)
  let combinedRegion: NodeRef = regionCondRefs[0];
  for (let i = 1; i < regionCondRefs.length; i++) {
    const combineId = `combineR${i}`;
    wf[combineId] = {
      inputs: {
        conditioning_1: combinedRegion,
        conditioning_2: regionCondRefs[i],
      },
      class_type: "ConditioningCombine",
    };
    combinedRegion = [combineId, 0];
  }

  // Combine base positive with regional conditionings
  wf["combinePos"] = {
    inputs: { conditioning_1: ["basepos", 0], conditioning_2: combinedRegion },
    class_type: "ConditioningCombine",
  };

  let finalPos: NodeRef = ["combinePos", 0];
  let finalNeg: NodeRef = ["neg", 0];

  // ControlNet (pose)
  if (controlNet.poseImageName) {
    wf["cnloader"] = {
      inputs: { control_net_name: controlNet.controlNetModel },
      class_type: "ControlNetLoader",
    };
    wf["poseimg"] = {
      inputs: { image: controlNet.poseImageName, upload: "image" },
      class_type: "LoadImage",
    };
    wf["cnapply"] = {
      inputs: {
        positive: finalPos,
        negative: finalNeg,
        control_net: ["cnloader", 0],
        image: ["poseimg", 0],
        vae: ["chk", 2],
        strength: controlNet.strength,
        start_percent: controlNet.startPercent,
        end_percent: controlNet.endPercent,
      },
      class_type: "ControlNetApplyAdvanced",
    };
    finalPos = ["cnapply", 0];
    finalNeg = ["cnapply", 1];
  }

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
      positive: finalPos,
      negative: finalNeg,
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
