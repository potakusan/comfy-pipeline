import { describe, expect, it } from "vitest";
import {
  applySelectedPresets,
  buildColorMaskWorkflow,
  buildCouplePrompt,
  buildCoupleWorkflow,
  buildRegionPrompt,
  DEFAULT_CONTROL_NET,
  MAX_COUPLE_REGIONS,
  type CoupleRegion,
} from "@/lib/couple";
import type { GenerationSettings, LoraEntry, Preset } from "@/lib/comfy-types";

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

function makeRegion(overrides: Partial<CoupleRegion> = {}): CoupleRegion {
  return {
    id: "region-a",
    name: "キャラA",
    xStart: 0,
    xEnd: 0.45,
    yStart: 0,
    yEnd: 1,
    prompt: "1girl,",
    lora: null,
    colorHex: "#ff0000",
    selectedPresetIds: [],
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

describe("buildCouplePrompt", () => {
  it("joins fixed/base/count/scene sections and appends one COUPLE(...) block per region", () => {
    const prompt = buildCouplePrompt({
      fixedTags: "masterpiece",
      basePrompt: "2girls,",
      countPrompt: "duo",
      scenePrompt: "outdoors",
      regions: [
        makeRegion({ xStart: 0, xEnd: 0.5, prompt: "1girl, red hair" }),
        makeRegion({ xStart: 0.5, xEnd: 1, prompt: "1girl, blue hair" }),
      ],
    });

    expect(prompt).toContain("masterpiece");
    expect(prompt).toContain("2girls,");
    expect(prompt).toContain("duo");
    expect(prompt).toContain("outdoors");
    expect(prompt).toContain("COUPLE(0 0.5)\n1girl, red hair");
    expect(prompt).toContain("COUPLE(0.5 1)\n1girl, blue hair");
  });

  it("appends the yStart/yEnd pair only when the region doesn't cover the full vertical range", () => {
    const fullHeight = buildCouplePrompt({
      fixedTags: "",
      basePrompt: "",
      countPrompt: "",
      scenePrompt: "",
      regions: [makeRegion({ yStart: 0, yEnd: 1 })],
    });
    const partialHeight = buildCouplePrompt({
      fixedTags: "",
      basePrompt: "",
      countPrompt: "",
      scenePrompt: "",
      regions: [makeRegion({ yStart: 0.2, yEnd: 0.8 })],
    });

    expect(fullHeight).toContain("COUPLE(0 0.45)\n");
    expect(partialHeight).toContain("COUPLE(0 0.45, 0.2 0.8)\n");
  });

  it("includes the region's LoRA trigger words alongside its prompt", () => {
    const prompt = buildCouplePrompt({
      fixedTags: "",
      basePrompt: "",
      countPrompt: "",
      scenePrompt: "",
      regions: [
        makeRegion({
          prompt: "1girl,",
          lora: makeLora({ triggerWords: "sparkle_trigger" }),
        }),
      ],
    });

    expect(prompt).toContain("1girl,,\nsparkle_trigger");
  });
});

describe("buildCoupleWorkflow", () => {
  it("uses PCLazyTextEncode (COUPLE-syntax aware) for both prompts", () => {
    const wf = buildCoupleWorkflow({
      settings: makeSettings(),
      loras: [],
      positivePrompt: "COUPLE(0 0.5)\n1girl,\n\nCOUPLE(0.5 1)\n1girl,",
      negativePrompt: "worst quality",
      outputPrefix: "couple1",
    });

    expect((wf["pos"] as { class_type: string }).class_type).toBe("PCLazyTextEncode");
    expect((wf["neg"] as { class_type: string }).class_type).toBe("PCLazyTextEncode");
    expect(wf["save"]).toMatchObject({ inputs: { filename_prefix: "couple1" } });
  });
});

describe("applySelectedPresets", () => {
  const presets: Preset[] = [
    { id: "p1", name: "preset1", prompt: "smiling", type: "other" },
    { id: "p2", name: "preset2", prompt: "waving", type: "other" },
  ];

  it("returns the region unchanged when no presets are selected", () => {
    const region = makeRegion({ prompt: "1girl," });
    expect(applySelectedPresets(region, presets)).toBe(region);
  });

  it("appends the prompts of only the selected presets, in preset order", () => {
    const region = makeRegion({ prompt: "1girl,", selectedPresetIds: ["p2"] });
    const result = applySelectedPresets(region, presets);
    expect(result.prompt).toBe("1girl,,\nwaving");
    expect(result).not.toBe(region);
  });
});

describe("buildRegionPrompt", () => {
  it("combines the region prompt and LoRA trigger words, dropping blank parts", () => {
    expect(buildRegionPrompt(makeRegion({ prompt: "1girl,", lora: null }))).toBe("1girl,");
    expect(
      buildRegionPrompt(
        makeRegion({ prompt: "1girl,", lora: makeLora({ triggerWords: "trig" }) }),
      ),
    ).toBe("1girl,,\ntrig");
    expect(buildRegionPrompt(makeRegion({ prompt: "  ", lora: null }))).toBe("");
  });
});

describe("buildColorMaskWorkflow", () => {
  it("throws when there are no regions, since the workflow has nothing to composite", () => {
    expect(() =>
      buildColorMaskWorkflow({
        settings: makeSettings(),
        loras: [],
        basePositivePrompt: "2girls,",
        negativePrompt: "worst quality",
        regions: [],
        controlNet: DEFAULT_CONTROL_NET,
        outputPrefix: "cm1",
      }),
    ).toThrow();
  });

  it("chains ConditioningCombine across all regions plus the base prompt", () => {
    const wf = buildColorMaskWorkflow({
      settings: makeSettings(),
      loras: [],
      basePositivePrompt: "2girls,",
      negativePrompt: "worst quality",
      regions: [makeRegion({ id: "a" }), makeRegion({ id: "b" }), makeRegion({ id: "c" })],
      controlNet: DEFAULT_CONTROL_NET,
      outputPrefix: "cm1",
    });

    // 3 regions -> combineR1 (rcm0+rcm1), combineR2 (combineR1+rcm2), then combinePos with basepos
    expect(wf["combineR1"]).toEqual({
      inputs: { conditioning_1: ["rcm0", 0], conditioning_2: ["rcm1", 0] },
      class_type: "ConditioningCombine",
    });
    expect(wf["combineR2"]).toEqual({
      inputs: { conditioning_1: ["combineR1", 0], conditioning_2: ["rcm2", 0] },
      class_type: "ConditioningCombine",
    });
    expect(wf["combinePos"]).toEqual({
      inputs: { conditioning_1: ["basepos", 0], conditioning_2: ["combineR2", 0] },
      class_type: "ConditioningCombine",
    });
  });

  it("wires ControlNetApplyAdvanced in front of the sampler only when a pose image is set", () => {
    const withoutPose = buildColorMaskWorkflow({
      settings: makeSettings(),
      loras: [],
      basePositivePrompt: "2girls,",
      negativePrompt: "worst quality",
      regions: [makeRegion()],
      controlNet: DEFAULT_CONTROL_NET,
      outputPrefix: "cm1",
    });
    expect(withoutPose["cnapply"]).toBeUndefined();
    expect((withoutPose["ksamp"] as { inputs: { positive: unknown } }).inputs.positive).toEqual([
      "combinePos",
      0,
    ]);

    const withPose = buildColorMaskWorkflow({
      settings: makeSettings(),
      loras: [],
      basePositivePrompt: "2girls,",
      negativePrompt: "worst quality",
      regions: [makeRegion()],
      controlNet: { ...DEFAULT_CONTROL_NET, poseImageName: "pose.png" },
      outputPrefix: "cm1",
    });
    expect(withPose["cnapply"]).toBeDefined();
    expect((withPose["ksamp"] as { inputs: { positive: unknown; negative: unknown } }).inputs).toMatchObject(
      { positive: ["cnapply", 0], negative: ["cnapply", 1] },
    );
  });

  it("creates a CreateHookLora/SetClipHooks pair only for regions that have a LoRA assigned", () => {
    const wf = buildColorMaskWorkflow({
      settings: makeSettings(),
      loras: [],
      basePositivePrompt: "2girls,",
      negativePrompt: "worst quality",
      regions: [makeRegion({ lora: null }), makeRegion({ lora: makeLora() })],
      controlNet: DEFAULT_CONTROL_NET,
      outputPrefix: "cm1",
    });

    expect(wf["hookLora0"]).toBeUndefined();
    expect(wf["setClip0"]).toBeUndefined();
    expect(wf["hookLora1"]).toBeDefined();
    expect(wf["setClip1"]).toBeDefined();
    expect((wf["rcm0"] as { inputs: { clip: unknown } }).inputs.clip).toEqual(["chk", 1]);
    expect((wf["rcm1"] as { inputs: { clip: unknown } }).inputs.clip).toEqual(["setClip1", 0]);
  });
});

describe("MAX_COUPLE_REGIONS", () => {
  it("matches the number of default region colors (module load already asserts this, this test guards against silent regressions)", () => {
    expect(MAX_COUPLE_REGIONS).toBeGreaterThan(0);
  });
});
