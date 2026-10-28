import { describe, expect, it } from "vitest";
import {
  assemblePositivePrompt,
  buildGenerationRecipe,
  buildPromptSegments,
  batchPresetFromRecipe,
  mergePresetsWithSnapshot,
  applySegmentEdits,
  applySegmentEditsToSegments,
  buildRecipeSet,
  buildMoreGenerationRun,
  resolvePresetOverrides,
  type SeedRecipeGroup,
  type BatchRunOverrides,
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

describe("batchPresetFromRecipe", () => {
  const recipe = buildGenerationRecipe({
    variableLora: null,
    fixedLoras: [],
    fixedTags: "masterpiece",
    negativePrompt: "bad",
    presets,
    additionalPromptMode: "random",
    additionalPromptLines: ["a", "b"],
    variationTags: ["from above"],
    segments: [],
    variableInputValues: { x: "1" },
    batchPreset: {
      id: "bp-orig",
      name: "orig",
      countPresetId: "stale",
      posePresetId: null,
      otherPresetIds: ["stale2"],
      additionalPrompt: "stale",
      additionalPromptMode: "all",
      fixedTags: "stale",
      negativePrompt: "stale",
      variationEnabled: false,
      variationTags: [],
      batchCount: 9,
    },
  });

  it("keeps id/name/batchCount from the original but takes slots from the recipe", () => {
    const bp = batchPresetFromRecipe(recipe, { id: "n", name: "n", batchCount: 1 });
    expect(bp).toMatchObject({
      id: "bp-orig",
      name: "orig",
      batchCount: 9,
      countPresetId: "c1",
      posePresetId: "po1",
      otherPresetIds: ["o1", "o2"],
      additionalPrompt: "a\nb",
      additionalPromptMode: "random",
      fixedTags: "masterpiece",
      negativePrompt: "bad",
      variationEnabled: true,
      variableValues: { x: "1" },
    });
  });

  it("falls back to the given id/name/batchCount without a batch preset snapshot", () => {
    const bp = batchPresetFromRecipe(
      { ...recipe, batchPreset: undefined },
      { id: "n", name: "folder", batchCount: 3 },
    );
    expect(bp).toMatchObject({ id: "n", name: "folder", batchCount: 3 });
  });
});

describe("mergePresetsWithSnapshot", () => {
  it("prefers snapshots and appends library presets not in the snapshot", () => {
    const lib = [preset("a", "other", "new a"), preset("b", "other", "b")];
    const snap = [preset("a", "other", "old a"), preset("gone", "other", "gone")];
    const merged = mergePresetsWithSnapshot(lib, snap);
    expect(merged.map((p) => `${p.id}:${p.prompt}`)).toEqual([
      "a:old a",
      "gone:gone",
      "b:b",
    ]);
  });
});

describe("applySegmentEdits", () => {
  const prompt = "masterpiece\n\nlong hair, dress lift\n\nstanding\n\nclassroom";

  it("replaces a substring inside a segment", () => {
    expect(
      applySegmentEdits(prompt, [{ from: "dress lift", to: "dress pull" }]),
    ).toBe("masterpiece\n\nlong hair, dress pull\n\nstanding\n\nclassroom");
  });

  it("deletes a whole segment and collapses the blank lines it leaves", () => {
    expect(applySegmentEdits(prompt, [{ from: "standing", to: "" }])).toBe(
      "masterpiece\n\nlong hair, dress lift\n\nclassroom",
    );
  });

  it("deleting the first/last segment leaves no leading/trailing blank lines", () => {
    expect(
      applySegmentEdits(prompt, [
        { from: "masterpiece", to: "" },
        { from: "classroom", to: "" },
      ]),
    ).toBe("long hair, dress lift\n\nstanding");
  });

  it("ignores empty `from` and returns the text unchanged without edits", () => {
    expect(applySegmentEdits(prompt, [{ from: "", to: "x" }])).toBe(prompt);
    expect(applySegmentEdits(prompt, undefined)).toBe(prompt);
  });

  it("keeps %%variables%% in replacement text for the later resolve step", () => {
    expect(
      applySegmentEdits("a\n\nstanding", [{ from: "standing", to: "%%pose%%" }]),
    ).toBe("a\n\n%%pose%%");
  });
});

describe("applySegmentEditsToSegments", () => {
  it("applies edits per segment and drops segments that become empty", () => {
    const segs = [
      { source: "fixedTags" as const, text: "masterpiece" },
      { source: "preset" as const, text: "standing" },
      { source: "preset" as const, text: "dress lift" },
    ];
    expect(
      applySegmentEditsToSegments(segs, [
        { from: "standing", to: "" },
        { from: "dress lift", to: "dress pull" },
      ]),
    ).toEqual([
      { source: "fixedTags", text: "masterpiece" },
      { source: "preset", text: "dress pull" },
    ]);
  });
});

describe("mergePresetsWithSnapshot duplicates", () => {
  it("collapses repeated snapshots of the same preset id", () => {
    const ph = preset("ph1", "physical", "loli");
    const merged = mergePresetsWithSnapshot([ph], [ph, { ...ph }, ph]);
    expect(merged.map((p) => p.id)).toEqual(["ph1"]);
  });
});

describe("buildRecipeSet / resolvePresetOverrides", () => {
  const group = (key: string, scene: string, batchPresetId = "bp1"): SeedRecipeGroup => {
    const p = { ...presets, selectedScene: preset(scene, "scene", `${scene} prompt`) };
    return {
      key,
      batchPresetId,
      name: `name-${key}`,
      queueLabel: `q-${key}`,
      seeds: [
        { id: "a", filename: "a.png", seed: 1, upscaleSeed: null },
        { id: "b", filename: "b.png", seed: 2, upscaleSeed: null },
      ],
      recipe: buildGenerationRecipe({
        variableLora: lora("v.safetensors", "chartrig"),
        fixedLoras: [],
        fixedTags: "masterpiece",
        negativePrompt: "",
        presets: p,
        additionalPromptMode: "all",
        additionalPromptLines: [],
        variationTags: [],
        batchPreset: {
          id: batchPresetId,
          name: `name-${key}`,
          countPresetId: null,
          posePresetId: null,
          otherPresetIds: [],
          additionalPrompt: "",
          additionalPromptMode: "all",
          fixedTags: "",
          negativePrompt: "",
          variationEnabled: false,
          variationTags: [],
          batchCount: 4,
        },
        segments: [],
      }),
    };
  };

  it("keeps each recipe's own scene per preset and disambiguates duplicate ids", () => {
    const { set, perPreset } = buildRecipeSet("f", [
      group("k1", "bgA"),
      group("k2", "bgB"),
    ]);
    expect(set.presets).toHaveLength(2);
    const [a, b] = set.presets;
    expect(a.id).not.toBe(b.id);
    expect(perPreset[a.id].scenePreset?.id).toBe("bgA");
    expect(perPreset[b.id].scenePreset?.id).toBe("bgB");
    expect(perPreset[a.id].batchCount).toBe(2);
  });

  it("overlays perPreset values onto the run overrides without undefined keys", () => {
    const base: BatchRunOverrides = {
      variableLora: null,
      physicalPresets: [],
      scenePreset: null,
      settings: {} as BatchRunOverrides["settings"],
      fixedTags: "",
      perPreset: { x: { scenePreset: preset("bgA", "scene", "x"), batchCount: undefined } },
    };
    const merged = resolvePresetOverrides(base, "x");
    expect(merged.scenePreset?.id).toBe("bgA");
    expect(merged.fixedTags).toBe("");
    expect("batchCount" in merged && merged.batchCount !== undefined).toBe(false);
    expect(resolvePresetOverrides(base, "none")).toBe(base);
  });
  it("builds an extra-generation run that rerolls seeds and keeps the recipe's slots", () => {
    const g = group("k1", "bgA");
    g.settings = { seed: 5, randomizeSeed: false } as SeedRecipeGroup["settings"];
    g.bindings = { outfit: "dress" };
    const run = buildMoreGenerationRun(g, 6)!;
    const id = run.presets[0].id;
    expect(run.overrides.settings.randomizeSeed).toBe(true);
    expect(run.overrides.perPreset?.[id].batchCount).toBe(6);
    expect(run.overrides.perPreset?.[id].scenePreset?.id).toBe("bgA");
    expect(run.overrides.variableValues).toEqual({ outfit: "dress" });
    expect(run.overrides.seedPool).toBeUndefined();
    expect(buildMoreGenerationRun({ ...g, settings: undefined }, 3)).toBeNull();
  });
});
