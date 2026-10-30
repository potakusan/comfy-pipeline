import { describe, expect, it } from "vitest";
import {
  buildBasePipeline,
  buildSamplingAndSaveTail,
  buildWorkflow,
} from "@/lib/comfy/workflow-builder";
import type { GenerationSettings, LoraEntry } from "@/lib/comfy/comfy-types";

function makeSettings(overrides: Partial<GenerationSettings> = {}): GenerationSettings {
  return {
    checkpoint: "checkpoint.safetensors",
    upscaleModel: "upscaler.pth",
    upscaleSteps: 0,
    width: 832,
    height: 1216,
    randomizeSeed: false,
    seed: 42,
    steps: 20,
    cfg: 7,
    sampler: "euler",
    scheduler: "normal",
    denoise: 1,
    ...overrides,
  };
}

function makeLora(overrides: Partial<LoraEntry> = {}): LoraEntry {
  return {
    name: "some-lora",
    strength: 0.8,
    clipStrength: 0.8,
    triggerWords: "",
    ...overrides,
  };
}

describe("buildBasePipeline", () => {
  it("registers checkpoint/upscaler/latent nodes and returns raw checkpoint refs when there are no LoRAs", () => {
    const wf: Record<string, unknown> = {};
    const settings = makeSettings();
    const { model, clip } = buildBasePipeline(wf, settings, []);

    expect(model).toEqual(["chk", 0]);
    expect(clip).toEqual(["chk", 1]);
    expect(wf["chk"]).toEqual({
      inputs: { ckpt_name: settings.checkpoint },
      class_type: "CheckpointLoaderSimple",
    });
    expect(wf["upm"]).toEqual({
      inputs: { model_name: settings.upscaleModel },
      class_type: "UpscaleModelLoader",
    });
    expect(wf["lat"]).toEqual({
      inputs: { width: settings.width, height: settings.height, batch_size: 1 },
      class_type: "EmptyLatentImage",
    });
  });

  it("builds a LoadImage → ImageScale(center crop) → VAEEncode init-latent chain when initImage is given", () => {
    const wf: Record<string, unknown> = {};
    const settings = makeSettings({ width: 1024, height: 1536 });
    buildBasePipeline(wf, settings, [], { name: "ref_123.png" });

    expect(wf["initimg"]).toEqual({
      inputs: { image: "ref_123.png" },
      class_type: "LoadImage",
    });
    expect(wf["initscale"]).toEqual({
      inputs: {
        image: ["initimg", 0],
        width: 1024,
        height: 1536,
        upscale_method: "lanczos",
        crop: "center",
      },
      class_type: "ImageScale",
    });
    expect(wf["lat"]).toEqual({
      inputs: { pixels: ["initscale", 0], vae: ["chk", 2] },
      class_type: "VAEEncode",
    });
  });

  it("chains multiple LoRAs and appends .safetensors only when missing", () => {
    const wf: Record<string, unknown> = {};
    const loras = [
      makeLora({ name: "already-suffixed.safetensors" }),
      makeLora({ name: "needs-suffix" }),
    ];
    const { model, clip } = buildBasePipeline(wf, makeSettings(), loras);

    expect(wf["lora0"]).toMatchObject({
      inputs: expect.objectContaining({
        lora_name: "already-suffixed.safetensors",
        model: ["chk", 0],
        clip: ["chk", 1],
      }),
    });
    expect(wf["lora1"]).toMatchObject({
      inputs: expect.objectContaining({
        lora_name: "needs-suffix.safetensors",
        model: ["lora0", 0],
        clip: ["lora0", 1],
      }),
    });
    expect(model).toEqual(["lora1", 0]);
    expect(clip).toEqual(["lora1", 1]);
  });
});

describe("buildSamplingAndSaveTail", () => {
  it("uses the fixed seed when randomizeSeed is false and skips the refinement pass when upscaleSteps is 0", () => {
    const wf: Record<string, unknown> = {};
    const settings = makeSettings({ randomizeSeed: false, seed: 12345, upscaleSteps: 0 });

    buildSamplingAndSaveTail(wf, {
      settings,
      model: ["chk", 0],
      positive: ["pos", 0],
      negative: ["neg", 0],
      outputPrefix: "out",
    });

    expect((wf["ksamp"] as { inputs: { seed: number } }).inputs.seed).toBe(12345);
    expect(wf["vae2"]).toBeUndefined();
    expect(wf["ksamp2"]).toBeUndefined();
    expect(wf["vae3"]).toBeUndefined();
    expect(wf["save"]).toEqual({
      inputs: { filename_prefix: "out", images: ["upi", 0] },
      class_type: "SaveImage",
    });
  });

  it("picks a random 32-bit seed when randomizeSeed is true", () => {
    const wf: Record<string, unknown> = {};
    buildSamplingAndSaveTail(wf, {
      settings: makeSettings({ randomizeSeed: true }),
      model: ["chk", 0],
      positive: ["pos", 0],
      negative: ["neg", 0],
      outputPrefix: "out",
    });

    const seed = (wf["ksamp"] as { inputs: { seed: number } }).inputs.seed;
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });

  it("adds a fixed-denoise refinement pass and saves from its output when upscaleSteps > 0", () => {
    const wf: Record<string, unknown> = {};
    const result = buildSamplingAndSaveTail(wf, {
      settings: makeSettings({ upscaleSteps: 10 }),
      model: ["chk", 0],
      positive: ["pos", 0],
      negative: ["neg", 0],
      outputPrefix: "out",
    });

    expect(wf["vae2"]).toEqual({
      inputs: { pixels: ["upi", 0], vae: ["chk", 2] },
      class_type: "VAEEncode",
    });
    const ksamp2 = wf["ksamp2"] as { inputs: { steps: number; denoise: number; seed: number } };
    expect(ksamp2.inputs.steps).toBe(10);
    expect(ksamp2.inputs.denoise).toBe(0.5);
    expect(result.upscaleSeed).toBe(ksamp2.inputs.seed);
    expect(wf["save"]).toEqual({
      inputs: { filename_prefix: "out", images: ["vae3", 0] },
      class_type: "SaveImage",
    });
  });

  it("uses settings.upscaleSeed for the refinement pass when provided, instead of a random value", () => {
    const wf: Record<string, unknown> = {};
    const { upscaleSeed } = buildSamplingAndSaveTail(wf, {
      settings: makeSettings({ upscaleSteps: 10, upscaleSeed: 999 }),
      model: ["chk", 0],
      positive: ["pos", 0],
      negative: ["neg", 0],
      outputPrefix: "out",
    });

    expect(upscaleSeed).toBe(999);
    expect((wf["ksamp2"] as { inputs: { seed: number } }).inputs.seed).toBe(999);
  });

  it("upscaleSeed is null in the return value when upscaleSteps is 0", () => {
    const wf: Record<string, unknown> = {};
    const { upscaleSeed } = buildSamplingAndSaveTail(wf, {
      settings: makeSettings({ upscaleSteps: 0 }),
      model: ["chk", 0],
      positive: ["pos", 0],
      negative: ["neg", 0],
      outputPrefix: "out",
    });

    expect(upscaleSeed).toBeNull();
  });
});

describe("buildWorkflow", () => {
  it("wires CLIPTextEncode prompts off the base pipeline's clip and feeds them into the sampler", () => {
    const { workflow: wf } = buildWorkflow({
      settings: makeSettings(),
      loras: [],
      positivePrompt: "1girl, masterpiece",
      negativePrompt: "worst quality",
      outputPrefix: "session1",
    });

    expect(wf["pos"]).toEqual({
      inputs: { text: "1girl, masterpiece", clip: ["chk", 1] },
      class_type: "CLIPTextEncode",
    });
    expect(wf["neg"]).toEqual({
      inputs: { text: "worst quality", clip: ["chk", 1] },
      class_type: "CLIPTextEncode",
    });
    expect((wf["ksamp"] as { inputs: { positive: unknown; negative: unknown } }).inputs).toMatchObject(
      { positive: ["pos", 0], negative: ["neg", 0] },
    );
  });

  it("returns the resolved seed/upscaleSeed actually embedded in the workflow", () => {
    const { workflow: wf, seed, upscaleSeed } = buildWorkflow({
      settings: makeSettings({ randomizeSeed: false, seed: 777, upscaleSteps: 10, upscaleSeed: 888 }),
      loras: [],
      positivePrompt: "p",
      negativePrompt: "n",
      outputPrefix: "out",
    });

    expect(seed).toBe(777);
    expect(upscaleSeed).toBe(888);
    expect((wf["ksamp"] as { inputs: { seed: number } }).inputs.seed).toBe(777);
    expect((wf["ksamp2"] as { inputs: { seed: number } }).inputs.seed).toBe(888);
  });

  it("upscaleSeed is null when upscaleSteps is 0 (no refinement pass)", () => {
    const { upscaleSeed } = buildWorkflow({
      settings: makeSettings({ upscaleSteps: 0 }),
      loras: [],
      positivePrompt: "p",
      negativePrompt: "n",
      outputPrefix: "out",
    });

    expect(upscaleSeed).toBeNull();
  });

  it("without initImage, keeps the EmptyLatentImage path and settings.denoise unchanged", () => {
    const { workflow: wf } = buildWorkflow({
      settings: makeSettings({ denoise: 1 }),
      loras: [],
      positivePrompt: "p",
      negativePrompt: "n",
      outputPrefix: "out",
    });
    expect((wf["lat"] as { class_type: string }).class_type).toBe("EmptyLatentImage");
    expect((wf["ksamp"] as { inputs: { denoise: number } }).inputs.denoise).toBe(1);
    expect(wf["initimg"]).toBeUndefined();
  });

  it("with initImage, encodes the reference as init latent and overrides the main KSampler denoise", () => {
    const { workflow: wf } = buildWorkflow({
      settings: makeSettings({ denoise: 1, upscaleSteps: 10 }),
      loras: [],
      positivePrompt: "p",
      negativePrompt: "n",
      outputPrefix: "out",
      initImage: { name: "ref_9.png", denoise: 0.45 },
    });
    expect((wf["lat"] as { class_type: string }).class_type).toBe("VAEEncode");
    expect((wf["initimg"] as { inputs: { image: string } }).inputs.image).toBe("ref_9.png");
    expect((wf["ksamp"] as { inputs: { denoise: number; latent_image: unknown } }).inputs).toMatchObject(
      { denoise: 0.45, latent_image: ["lat", 0] },
    );
    // 精緻化パスの denoise は 0.5 固定のまま
    expect((wf["ksamp2"] as { inputs: { denoise: number } }).inputs.denoise).toBe(0.5);
  });
});

describe("Anima (modelFamily: anima)", () => {
  const anima = () =>
    makeSettings({
      modelFamily: "anima",
      unet: "anima-base-v1.0.safetensors",
      textEncoder: "qwen_3_06b_base.safetensors",
      vae: "qwen_image_vae.safetensors",
    });

  it("UNETLoader/CLIPLoader/VAELoader を個別に読み込み、CheckpointLoaderSimple は使わない", () => {
    const wf: Record<string, unknown> = {};
    const { model, clip, vae } = buildBasePipeline(wf, anima(), []);
    expect(model).toEqual(["unet", 0]);
    expect(clip).toEqual(["clipl", 0]);
    expect(vae).toEqual(["vael", 0]);
    expect(wf["unet"]).toEqual({
      inputs: { unet_name: "anima-base-v1.0.safetensors", weight_dtype: "default" },
      class_type: "UNETLoader",
    });
    expect(wf["clipl"]).toEqual({
      inputs: { clip_name: "qwen_3_06b_base.safetensors", type: "stable_diffusion", device: "default" },
      class_type: "CLIPLoader",
    });
    expect(wf["vael"]).toEqual({
      inputs: { vae_name: "qwen_image_vae.safetensors" },
      class_type: "VAELoader",
    });
    expect(wf["chk"]).toBeUndefined();
  });

  it("LoRAはUNet/CLIPの出力に連結され、デコード・アップスケール再エンコード・ADetailer が個別VAEを参照する", () => {
    const { workflow } = buildWorkflow({
      settings: { ...anima(), upscaleSteps: 10 },
      loras: [makeLora({ families: ["anima"] })],
      positivePrompt: "1girl",
      negativePrompt: "bad",
      outputPrefix: "o/x",
      adetailer: [{ id: "a", label: "顔", enabled: true, model: "bbox/face.pt", prompt: "", denoise: 0.4, steps: 20, bboxThreshold: 0.5, dilation: 10, cropFactor: 3, guideSize: 512, maxSize: 1024, feather: 5 }],
    });
    const wf = workflow as Record<string, { inputs: Record<string, unknown> }>;
    expect(wf["lora0"].inputs.model).toEqual(["unet", 0]);
    expect(wf["lora0"].inputs.clip).toEqual(["clipl", 0]);
    expect(wf["vae"].inputs.vae).toEqual(["vael", 0]);
    expect(wf["vae2"].inputs.vae).toEqual(["vael", 0]);
    expect(wf["vae3"].inputs.vae).toEqual(["vael", 0]);
    expect(wf["adet0"].inputs.vae).toEqual(["vael", 0]);
    expect(JSON.stringify(workflow)).not.toContain('"chk"');
  });
});

describe("系統別LoRAペア (ai-styles-dump)", () => {
  const sdxlFile = "best_of_ai_styles_noob-eps-0.5_v2.217-edm2-pass";
  const animaFile = "mixed_styles_anima-base1_v6";
  const loraFile = (family: "sdxl" | "anima", name: string) => {
    const wf: Record<string, unknown> = {};
    buildBasePipeline(wf, makeSettings({ modelFamily: family }), [makeLora({ name })]);
    return (wf["lora0"] as { inputs: { lora_name: string } }).inputs.lora_name;
  };

  it("保存済みの名前がどちらの系統のファイルでも、現在の系統のファイルに差し替える", () => {
    expect(loraFile("anima", sdxlFile)).toBe(`${animaFile}.safetensors`);
    expect(loraFile("anima", `${sdxlFile}.safetensors`)).toBe(`${animaFile}.safetensors`);
    expect(loraFile("sdxl", animaFile)).toBe(`${sdxlFile}.safetensors`);
    expect(loraFile("sdxl", sdxlFile)).toBe(`${sdxlFile}.safetensors`);
  });

  it("ペア定義の無いLoRAはそのまま使う", () => {
    expect(loraFile("sdxl", "sexy_details_v5")).toBe("sexy_details_v5.safetensors");
  });
});

describe("LoRAの対応系統", () => {
  const loraNames = (family: "sdxl" | "anima", loras: LoraEntry[]) => {
    const wf: Record<string, unknown> = {};
    buildBasePipeline(wf, makeSettings({ modelFamily: family }), loras);
    return Object.keys(wf)
      .filter((k) => k.startsWith("lora"))
      .map((k) => (wf[k] as { inputs: { lora_name: string } }).inputs.lora_name);
  };

  it("対応系統を指定していないLoRAはAnimaでは適用しない(SDXLは従来どおり)", () => {
    const loras = [makeLora({ name: "sdxl_only" })];
    expect(loraNames("anima", loras)).toEqual([]);
    expect(loraNames("sdxl", loras)).toEqual(["sdxl_only.safetensors"]);
  });

  it("families に anima を含むLoRAはAnimaで適用し、除いたSDXLでは外す", () => {
    const loras = [makeLora({ name: "anima_lora", families: ["anima"] })];
    expect(loraNames("anima", loras)).toEqual(["anima_lora.safetensors"]);
    expect(loraNames("sdxl", loras)).toEqual([]);
  });

  it("除外されたLoRAの後ろのLoRAも正しく連結される", () => {
    const loras = [makeLora({ name: "sdxl_only" }), makeLora({ name: "both", families: ["sdxl", "anima"] })];
    const wf: Record<string, unknown> = {};
    const { model } = buildBasePipeline(wf, makeSettings({ modelFamily: "anima" }), loras);
    expect(model).toEqual(["lora0", 0]);
    expect((wf["lora0"] as { inputs: { model: unknown } }).inputs.model).toEqual(["unet", 0]);
  });
});
