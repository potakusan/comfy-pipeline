import { describe, expect, it } from "vitest";
import { buildWorkflow } from "@/lib/comfy/workflow-builder";
import {
  activeAdetailerTargets,
  newAdetailerTarget,
  type AdetailerTarget,
} from "@/lib/comfy/adetailer";
import type { GenerationSettings } from "@/lib/comfy/comfy-types";

const settings: GenerationSettings = {
  checkpoint: "c.safetensors",
  upscaleModel: "u.pth",
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
};

type Node = { class_type: string; inputs: Record<string, unknown> };
const build = (adetailer?: AdetailerTarget[], s = settings) =>
  buildWorkflow({
    settings: s,
    loras: [],
    positivePrompt: "p",
    negativePrompt: "n",
    outputPrefix: "out",
    adetailer,
  }).workflow as Record<string, Node>;

describe("activeAdetailerTargets", () => {
  it("keeps only enabled targets that have a detector model", () => {
    const face = newAdetailerTarget("face");
    const hand = { ...newAdetailerTarget("hand"), enabled: false };
    const noModel = { ...newAdetailerTarget("face"), model: " " };
    expect(activeAdetailerTargets([face, hand, noModel])).toEqual([face]);
    expect(activeAdetailerTargets(undefined)).toEqual([]);
  });
});

describe("buildWorkflow with adetailer", () => {
  it("leaves the graph untouched without active targets", () => {
    const wf = build([{ ...newAdetailerTarget("face"), enabled: false }]);
    expect(Object.keys(wf).some((k) => k.startsWith("adet"))).toBe(false);
    expect(wf.save.inputs.images).toEqual(["upi", 0]);
  });

  it("chains one FaceDetailer per target between the upscale and SaveImage", () => {
    const face = newAdetailerTarget("face");
    const hand = { ...newAdetailerTarget("hand"), denoise: 0.3 };
    const wf = build([face, hand]);

    expect(wf.adet0.class_type).toBe("FaceDetailer");
    expect(wf.adet0.inputs.image).toEqual(["upi", 0]);
    expect(wf.adet0.inputs.bbox_detector).toEqual(["adet0_det", 0]);
    expect(wf.adet0_det.inputs.model_name).toBe(face.model);

    expect(wf.adet1.inputs.image).toEqual(["adet0", 0]);
    expect(wf.adet1.inputs.denoise).toBe(0.3);
    expect(wf.adet1_det.inputs.model_name).toBe(hand.model);

    expect(wf.save.inputs.images).toEqual(["adet1", 0]);
  });

  it("feeds the refined (post upscale-refine) image and reuses the main seed and sampler", () => {
    const wf = build([newAdetailerTarget("face")], { ...settings, upscaleSteps: 10 });
    expect(wf.adet0.inputs.image).toEqual(["vae3", 0]);
    expect(wf.adet0.inputs.seed).toBe(42);
    expect(wf.adet0.inputs.cfg).toBe(7);
    expect(wf.adet0.inputs.sampler_name).toBe("euler");
    expect(wf.adet0.inputs.vae).toEqual(["chk", 2]);
  });

  it("uses the base positive unless the target has its own prompt", () => {
    const base = build([newAdetailerTarget("face")]);
    expect(base.adet0.inputs.positive).toEqual(["pos", 0]);
    expect(base.adet0_pos).toBeUndefined();

    const own = build([{ ...newAdetailerTarget("face"), prompt: "detailed eyes" }]);
    expect(own.adet0_pos.class_type).toBe("CLIPTextEncode");
    expect(own.adet0_pos.inputs.text).toBe("detailed eyes");
    expect(own.adet0.inputs.positive).toEqual(["adet0_pos", 0]);
  });
});
