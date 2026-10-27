import { describe, expect, it } from "vitest";
import {
  assemblePositivePrompt,
  buildGenerationRecipe,
  buildPromptSegments,
  type LoraEntry,
  type Preset,
  type QueueItemBatchPresets,
} from "@/lib/comfy";

const lora = (name: string, triggerWords: string): LoraEntry => ({
  name,
  strength: 1,
  clipStrength: 1,
  triggerWords,
});

const preset = (
  id: string,
  type: Preset["type"],
  prompt: string,
  l?: LoraEntry,
): Preset => ({ id, name: `${id}-name`, type, prompt, lora: l });

const emptyPresets: QueueItemBatchPresets = {
  selectedPhysicals: [],
  selectedCount: null,
  selectedPose: null,
  selectedScene: null,
  selectedOthers: [],
};

const presets: QueueItemBatchPresets = {
  selectedPhysicals: [preset("ph1", "physical", "long hair\n# comment\nblue eyes")],
  selectedCount: preset("c1", "count", "1girl"),
  selectedPose: preset("po1", "pose", "standing", lora("p.safetensors", "posetrig")),
  selectedScene: preset("s1", "scene", "classroom"),
  selectedOthers: [
    preset("o1", "other", "%%clothedfemale%%"),
    preset("o2", "other", "# only comment"),
  ],
};

describe("buildPromptSegments", () => {
  it("joins back to the assembled prompt (same order and comment stripping)", () => {
    const variableLora = lora("v.safetensors", "chartrig");
    const fixedLoras = [lora("f.safetensors", "fixedtrig")];
    const segments = buildPromptSegments({
      fixedTags: "masterpiece\n# note",
      fixedLoras,
      variableLora,
      presets,
      additionalText: "extra line",
      variationTag: "from above",
    });
    const assembled = assemblePositivePrompt({
      variableLora,
      fixedLoras,
      selectedPhysicalPresets: presets.selectedPhysicals,
      selectedCountPreset: presets.selectedCount,
      selectedPosePreset: presets.selectedPose,
      selectedScenePreset: presets.selectedScene,
      selectedOtherPresets: presets.selectedOthers,
      additionalPrompt: "extra line",
      fixedPrefix: "masterpiece\n# note",
    });
    expect(segments.map((s) => s.text).join("\n\n")).toBe(`${assembled}\n\nfrom above`);
  });

  it("records the source of each segment", () => {
    const segments = buildPromptSegments({
      fixedTags: "",
      fixedLoras: [],
      variableLora: lora("v.safetensors", "chartrig"),
      presets,
    });
    expect(segments[0]).toEqual({ source: "variableLora", text: "chartrig" });
    const pose = segments.filter((s) => s.presetId === "po1");
    expect(pose.map((s) => s.source)).toEqual(["preset", "presetLora"]);
    expect(pose[0].slot).toBe("pose");
    expect(segments.some((s) => s.presetId === "o2")).toBe(false);
  });

  it("skips empty fixed tags and empty additional/variation", () => {
    expect(
      buildPromptSegments({
        fixedTags: "  ",
        fixedLoras: [],
        variableLora: null,
        presets: emptyPresets,
        additionalText: " ",
        variationTag: "",
      }),
    ).toEqual([]);
  });
});

describe("buildGenerationRecipe", () => {
  it("snapshots only variables used by the segments, with implicit input default", () => {
    const segments = buildPromptSegments({
      fixedTags: "",
      fixedLoras: [],
      variableLora: null,
      presets,
    });
    const recipe = buildGenerationRecipe({
      variableLora: null,
      fixedLoras: [],
      fixedTags: "",
      negativePrompt: "bad",
      presets,
      additionalPromptMode: "all",
      additionalPromptLines: [],
      variationTags: [],
      segments,
      variableDefs: {
        clothedfemale: { name: "clothedfemale", mode: "random", candidates: ["a", "b"] },
        unused: { name: "unused", mode: "fixed", value: "x" },
      },
    });
    expect(recipe.schemaVersion).toBe(1);
    expect(Object.keys(recipe.variableDefs)).toEqual(["clothedfemale"]);
    expect(recipe.variableDefs.clothedfemale.candidates).toEqual(["a", "b"]);
  });

  it("keeps only group/denoise of the reference pool", () => {
    const recipe = buildGenerationRecipe({
      variableLora: null,
      fixedLoras: [],
      fixedTags: "",
      negativePrompt: "",
      presets: emptyPresets,
      additionalPromptMode: "all",
      additionalPromptLines: [],
      variationTags: [],
      segments: [],
      imageRefPool: { group: "g", denoise: 0.5, names: ["a.png"] },
    });
    expect(recipe.imageRefPool).toEqual({ group: "g", denoise: 0.5 });
  });
});
