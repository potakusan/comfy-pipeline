import type { GenerationSettings, LoraEntry } from "./comfy-types";
import { resolveLoraName } from "./lora-family";
import { appendAdetailerChain, type AdetailerTarget, type NodeRef } from "./adetailer";

export type { NodeRef };

/**
 * チェックポイント読み込み+アップスケールモデル+空latent+LoRAチェーンを組み立てる、
 * buildWorkflow/buildCoupleWorkflow/buildColorMaskWorkflow共通のベースパイプライン。
 */
export function buildBasePipeline(
  wf: Record<string, unknown>,
  settings: GenerationSettings,
  loras: LoraEntry[],
  initImage?: { name: string },
): { model: NodeRef; clip: NodeRef; vae: NodeRef } {
  let model: NodeRef;
  let clip: NodeRef;
  let vae: NodeRef;
  if (settings.modelFamily === "anima") {
    wf["unet"] = {
      inputs: { unet_name: settings.unet ?? "", weight_dtype: "default" },
      class_type: "UNETLoader",
    };
    wf["clipl"] = {
      inputs: { clip_name: settings.textEncoder ?? "", type: "stable_diffusion", device: "default" },
      class_type: "CLIPLoader",
    };
    wf["vael"] = {
      inputs: { vae_name: settings.vae ?? "" },
      class_type: "VAELoader",
    };
    model = ["unet", 0];
    clip = ["clipl", 0];
    vae = ["vael", 0];
  } else {
    wf["chk"] = {
      inputs: { ckpt_name: settings.checkpoint },
      class_type: "CheckpointLoaderSimple",
    };
    model = ["chk", 0];
    clip = ["chk", 1];
    vae = ["chk", 2];
  }

  wf["upm"] = {
    inputs: { model_name: settings.upscaleModel },
    class_type: "UpscaleModelLoader",
  };

  if (initImage) {
    // img2img: 空latentの代わりに下絵をVAEEncodeして初期latentにする。
    // アスペクト比不一致は中央クロップで吸収し、生成サイズは settings のまま。
    // 最終ノードのキーは "lat" のままにし、テールの latent_image 参照を変えない。
    wf["initimg"] = {
      inputs: { image: initImage.name },
      class_type: "LoadImage",
    };
    wf["initscale"] = {
      inputs: {
        image: ["initimg", 0],
        width: settings.width,
        height: settings.height,
        upscale_method: "lanczos",
        crop: "center",
      },
      class_type: "ImageScale",
    };
    wf["lat"] = {
      inputs: { pixels: ["initscale", 0], vae },
      class_type: "VAEEncode",
    };
  } else {
    wf["lat"] = {
      inputs: { width: settings.width, height: settings.height, batch_size: 1 },
      class_type: "EmptyLatentImage",
    };
  }

  loras.forEach((lora, i) => {
    const id = `lora${i}`;
    const loraName = `${resolveLoraName(lora.name, settings.modelFamily)}.safetensors`;
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

  return { model, clip, vae };
}

/**
 * KSampler→VAEDecode→アップスケール→(upscaleSteps>0時のみ)denoise 0.5固定の
 * リファインメントパス→SaveImageという、buildWorkflow/buildCoupleWorkflow/
 * buildColorMaskWorkflow全てで同一のテール処理。latent_imageは常に
 * buildBasePipelineが作る"lat"ノードを参照する。
 *
 * 実際に使用したseed/upscaleSeedを返す。呼び出し元がメタデータへ保存する値は
 * 必ずこの戻り値を使うこと(settingsに入れた値をそのまま使うと、
 * randomizeSeed/upscaleSeed省略時にランダム決定された実際の値と食い違う)。
 */
export function buildSamplingAndSaveTail(
  wf: Record<string, unknown>,
  {
    settings,
    model,
    positive,
    negative,
    outputPrefix,
    adetailer,
    vae = ["chk", 2],
  }: {
    settings: GenerationSettings;
    /** VAEの参照。省略時はチェックポイント一体型の VAE */
    vae?: NodeRef;
    model: NodeRef;
    positive: NodeRef;
    negative: NodeRef;
    outputPrefix: string;
    /** 指定時、アップスケール前に検出→再描画(顔・手など)を挟む。clip はその専用プロンプト用 */
    adetailer?: { targets: AdetailerTarget[] | undefined; clip: NodeRef };
  },
): { seed: number; upscaleSeed: number | null } {
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
    inputs: { samples: ["ksamp", 0], vae },
    class_type: "VAEDecode",
  };

  // 検出再描画(顔・手など)は生成解像度の画像に対して、アップスケール前に行う。
  // アップスケール後(例 4x)の巨大画像で検出・貼り戻しすると極端に重くなるため。
  const detailed: NodeRef = adetailer
    ? appendAdetailerChain(wf, {
        image: ["vae", 0],
        targets: adetailer.targets,
        settings,
        seed,
        model,
        clip: adetailer.clip,
        vae,
        positive,
        negative,
      })
    : ["vae", 0];

  wf["upi"] = {
    inputs: { upscale_model: ["upm", 0], image: detailed },
    class_type: "ImageUpscaleWithModel",
  };

  let saveSource: NodeRef = ["upi", 0];
  let upscaleSeed: number | null = null;
  if (settings.upscaleSteps > 0) {
    upscaleSeed = settings.upscaleSeed ?? Math.floor(Math.random() * 2 ** 32);
    wf["vae2"] = {
      inputs: { pixels: ["upi", 0], vae },
      class_type: "VAEEncode",
    };
    wf["ksamp2"] = {
      inputs: {
        seed: upscaleSeed,
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
      inputs: { samples: ["ksamp2", 0], vae },
      class_type: "VAEDecode",
    };
    saveSource = ["vae3", 0];
  }

  wf["save"] = {
    inputs: { filename_prefix: outputPrefix, images: saveSource },
    class_type: "SaveImage",
  };

  return { seed, upscaleSeed };
}

export function buildWorkflow({
  settings,
  loras,
  positivePrompt,
  negativePrompt,
  outputPrefix,
  initImage,
  adetailer,
}: {
  settings: GenerationSettings;
  loras: LoraEntry[];
  positivePrompt: string;
  negativePrompt: string;
  outputPrefix: string;
  /** 指定時は img2img。下絵を初期latentに使い、メインKSamplerの denoise をこの値にする。 */
  initImage?: { name: string; denoise: number };
  /** 顔・手などの検出再描画の対象。有効な対象が無ければ何も挟まない */
  adetailer?: AdetailerTarget[];
}): { workflow: Record<string, unknown>; seed: number; upscaleSeed: number | null } {
  const wf: Record<string, unknown> = {};

  const effSettings = initImage
    ? { ...settings, denoise: initImage.denoise }
    : settings;

  const { model, clip, vae } = buildBasePipeline(
    wf,
    effSettings,
    loras,
    initImage ? { name: initImage.name } : undefined,
  );

  wf["pos"] = {
    inputs: { text: positivePrompt, clip },
    class_type: "CLIPTextEncode",
  };

  wf["neg"] = {
    inputs: { text: negativePrompt, clip },
    class_type: "CLIPTextEncode",
  };

  const { seed, upscaleSeed } = buildSamplingAndSaveTail(wf, {
    settings: effSettings,
    vae,
    model,
    positive: ["pos", 0],
    negative: ["neg", 0],
    outputPrefix,
    adetailer: { targets: adetailer, clip },
  });

  return { workflow: wf, seed, upscaleSeed };
}
