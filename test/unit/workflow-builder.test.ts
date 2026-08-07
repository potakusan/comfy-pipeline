import { describe, expect, it } from "vitest";
import {
  buildBasePipeline,
  buildSamplingAndSaveTail,
  buildWorkflow,
} from "@/lib/workflow-builder";
import type { GenerationSettings, LoraEntry } from "@/lib/comfy-types";

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
    buildSamplingAndSaveTail(wf, {
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
    const ksamp2 = wf["ksamp2"] as { inputs: { steps: number; denoise: number } };
    expect(ksamp2.inputs.steps).toBe(10);
    expect(ksamp2.inputs.denoise).toBe(0.5);
    expect(wf["save"]).toEqual({
      inputs: { filename_prefix: "out", images: ["vae3", 0] },
      class_type: "SaveImage",
    });
  });
});

describe("buildWorkflow", () => {
  it("wires CLIPTextEncode prompts off the base pipeline's clip and feeds them into the sampler", () => {
    const wf = buildWorkflow({
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
});
