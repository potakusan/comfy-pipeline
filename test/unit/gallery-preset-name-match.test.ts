import { describe, expect, it } from "vitest";
import { findSetByFilenamePresetName } from "@/lib/gallery-preset-name-match";
import type { BatchPreset, BatchPresetSet, ReleasedSeed } from "@/lib/comfy";

function makePreset(overrides: Partial<BatchPreset> = {}): BatchPreset {
  return {
    id: "preset-1",
    name: "1_0_4_手コキ · 1人",
    countPresetId: null,
    posePresetId: null,
    otherPresetIds: [],
    additionalPrompt: "",
    additionalPromptMode: "all",
    fixedTags: "",
    negativePrompt: "",
    variationEnabled: false,
    variationTags: [],
    batchCount: 5,
    ...overrides,
  };
}

function makeSeed(overrides: Partial<ReleasedSeed> = {}): ReleasedSeed {
  return { id: "archive-1", filename: "out_00001_.png", seed: 1, upscaleSeed: null, ...overrides };
}

describe("findSetByFilenamePresetName", () => {
  it("matches a set whose preset name equals the filename's recovered prefix", () => {
    const preset = makePreset({ name: "1_0_4_手コキ · 1人" });
    const set: BatchPresetSet = { id: "set-1", name: "セットA", presets: [preset] };
    const seeds = [makeSeed({ filename: "1_0_4_手コキ · 1人_00004__rev_0001.png" })];

    expect(findSetByFilenamePresetName(seeds, [set])).toBe(set);
  });

  it("picks the most frequent extracted name when the pool spans multiple presets", () => {
    const majorityPreset = makePreset({ id: "p-majority", name: "ポーズA" });
    const minorityPreset = makePreset({ id: "p-minority", name: "ポーズB" });
    const setA: BatchPresetSet = { id: "set-a", name: "セットA", presets: [majorityPreset] };
    const setB: BatchPresetSet = { id: "set-b", name: "セットB", presets: [minorityPreset] };
    const seeds = [
      makeSeed({ filename: "ポーズA_00001_.png" }),
      makeSeed({ filename: "ポーズA_00002_.png" }),
      makeSeed({ filename: "ポーズB_00001_.png" }),
    ];

    expect(findSetByFilenamePresetName(seeds, [setA, setB])).toBe(setA);
  });

  it("returns undefined when no current preset name matches", () => {
    const preset = makePreset({ name: "全く違う名前" });
    const set: BatchPresetSet = { id: "set-1", name: "セットA", presets: [preset] };
    const seeds = [makeSeed({ filename: "1_0_4_手コキ · 1人_00004_.png" })];

    expect(findSetByFilenamePresetName(seeds, [set])).toBeUndefined();
  });

  it("returns undefined for an empty seed pool", () => {
    const set: BatchPresetSet = { id: "set-1", name: "セットA", presets: [makePreset()] };
    expect(findSetByFilenamePresetName([], [set])).toBeUndefined();
  });
});
