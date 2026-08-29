import { describe, expect, it } from "vitest";
import { buildReusablePromptSegment } from "@/lib/comfy/prompt-assembly";
import type { Preset } from "@/lib/comfy/comfy-types";

function makePreset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: "preset-1",
    name: "プリセット",
    prompt: "1girl,",
    type: "other",
    ...overrides,
  };
}

describe("buildReusablePromptSegment", () => {
  it("joins count/pose/scene/other preset text in a fixed order, skipping empty slots", () => {
    const result = buildReusablePromptSegment({
      selectedCountPreset: makePreset({ prompt: "duo," }),
      selectedPosePreset: null,
      selectedScenePreset: makePreset({ prompt: "outdoors," }),
      selectedOtherPresets: [makePreset({ prompt: "smiling," })],
    });

    expect(result).toBe("duo,\n\noutdoors,\n\nsmiling,");
  });

  it("appends a preset's LoRA trigger words right after its prompt text", () => {
    const result = buildReusablePromptSegment({
      selectedCountPreset: null,
      selectedPosePreset: makePreset({
        prompt: "1girl, sitting",
        lora: {
          name: "pose-lora",
          strength: 0.8,
          clipStrength: 0.8,
          triggerWords: "sitting_trigger",
        },
      }),
      selectedScenePreset: null,
      selectedOtherPresets: [],
    });

    expect(result).toBe("1girl, sitting\n\nsitting_trigger");
  });

  it("returns an empty string when nothing is selected", () => {
    expect(
      buildReusablePromptSegment({
        selectedCountPreset: null,
        selectedPosePreset: null,
        selectedScenePreset: null,
        selectedOtherPresets: [],
      }),
    ).toBe("");
  });

  it("strips comment lines (#-prefixed) from preset prompt text, matching assemblePositivePrompt", () => {
    const result = buildReusablePromptSegment({
      selectedCountPreset: makePreset({ prompt: "# comment\nduo," }),
      selectedPosePreset: null,
      selectedScenePreset: null,
      selectedOtherPresets: [],
    });

    expect(result).toBe("duo,");
  });
});
