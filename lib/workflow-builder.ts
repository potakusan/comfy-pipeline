import type { GenerationSettings, LoraEntry } from "./comfy-types";

export type NodeRef = [string, number];

/**
 * チェックポイント読み込み+アップスケールモデル+空latent+LoRAチェーンを組み立てる、
 * buildWorkflow/buildCoupleWorkflow/buildColorMaskWorkflow共通のベースパイプライン。
 */
export function buildBasePipeline(
  wf: Record<string, unknown>,
  settings: GenerationSettings,
  loras: LoraEntry[],
): { model: NodeRef; clip: NodeRef } {
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

  let model: NodeRef = ["chk", 0];
  let clip: NodeRef = ["chk", 1];

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
        model,
        clip,
      },
      class_type: "LoraLoader",
    };
    model = [id, 0];
    clip = [id, 1];
  });

  return { model, clip };
}

/**
 * KSampler→VAEDecode→アップスケール→(upscaleSteps>0時のみ)denoise 0.5固定の
 * リファインメントパス→SaveImageという、buildWorkflow/buildCoupleWorkflow/
 * buildColorMaskWorkflow全てで同一のテール処理。latent_imageは常に
 * buildBasePipelineが作る"lat"ノードを参照する。
 */
export function buildSamplingAndSaveTail(
  wf: Record<string, unknown>,
  {
    settings,
    model,
    positive,
    negative,
    outputPrefix,
  }: {
    settings: GenerationSettings;
    model: NodeRef;
    positive: NodeRef;
    negative: NodeRef;
    outputPrefix: string;
  },
): void {
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
      model,
      positive,
      negative,
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

  let saveSource: NodeRef = ["upi", 0];
  if (settings.upscaleSteps > 0) {
    wf["vae2"] = {
      inputs: { pixels: ["upi", 0], vae: ["chk", 2] },
      class_type: "VAEEncode",
    };
    wf["ksamp2"] = {
      inputs: {
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: settings.upscaleSteps,
        cfg: settings.cfg,
        sampler_name: settings.sampler,
        scheduler: settings.scheduler,
        denoise: 0.5,
        model,
        positive,
        negative,
        latent_image: ["vae2", 0],
      },
      class_type: "KSampler",
    };
    wf["vae3"] = {
      inputs: { samples: ["ksamp2", 0], vae: ["chk", 2] },
      class_type: "VAEDecode",
    };
    saveSource = ["vae3", 0];
  }

  wf["save"] = {
    inputs: { filename_prefix: outputPrefix, images: saveSource },
    class_type: "SaveImage",
  };
}

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

  const { model, clip } = buildBasePipeline(wf, settings, loras);

  wf["pos"] = {
    inputs: { text: positivePrompt, clip },
    class_type: "CLIPTextEncode",
  };

  wf["neg"] = {
    inputs: { text: negativePrompt, clip },
    class_type: "CLIPTextEncode",
  };

  buildSamplingAndSaveTail(wf, {
    settings,
    model,
    positive: ["pos", 0],
    negative: ["neg", 0],
    outputPrefix,
  });

  return wf;
}
