import { describe, expect, it } from "vitest";
import {
  buildGenerationRecipe,
  buildMoreGenerationRun,
  type LoraEntry,
  type Preset,
  type SeedRecipeGroup,
} from "@/lib/comfy";
import { buildBatchQueueItems } from "@/hooks/pipeline/build-batch-items";
import { resolveItemBatch } from "@/hooks/pipeline/resolve-batch";

const lora = (name: string, triggerWords: string): LoraEntry => ({
  name,
  strength: 1,
  clipStrength: 1,
  triggerWords,
});

const preset = (id: string, type: Preset["type"], prompt: string, extra?: Partial<Preset>): Preset => ({
  id,
  name: `${id}-name`,
  type,
  prompt,
  ...extra,
});

const fixed = lora("fixed.safetensors", "fixedtrig");

function makeGroup(): SeedRecipeGroup {
  const scene = preset("bg", "scene", "classroom\nbeach\nforest", { promptMode: "random" });
  const pose = preset("po", "pose", "standing");
  return {
    key: "pose-a",
    name: "pose-a",
    queueLabel: "q",
    seeds: [],
    settings: { seed: 1, randomizeSeed: false } as SeedRecipeGroup["settings"],
    bindings: { outfit: "dress" },
    recipe: buildGenerationRecipe({
      variableLora: lora("v.safetensors", "chartrig"),
      fixedLoras: [fixed],
      fixedTags: "masterpiece",
      negativePrompt: "bad",
      presets: {
        selectedPhysicals: [],
        selectedCount: null,
        selectedPose: pose,
        selectedScene: scene,
        selectedOthers: [],
      },
      additionalPromptMode: "all",
      additionalPromptLines: [],
      variationTags: [],
      segments: [],
      adetailer: [{ target: "face" } as never],
    }),
  };
}

function makeItem(count: number) {
  const group = makeGroup();
  const run = buildMoreGenerationRun(group, count)!;
  const [item] = buildBatchQueueItems(
    run.presets,
    run.overrides,
    { runId: "r", startedAt: 0 },
    {
      countPresets: [],
      posePresets: [],
      otherPresets: [],
      fixedTags: "",
      fixedLoras: group.recipe.fixedLoras,
      variableDefs: {},
      adetailer: [],
    },
  );
  return { group, item };
}

describe("追加生成のアイテム組み立て", () => {
  it("レシピと同じスロット・固定タグ・ADetailerを持ち、枚数が反映される", () => {
    const { item } = makeItem(6);
    expect(item.batchCount).toBe(6);
    expect(item.fixedTags).toBe("masterpiece");
    expect(item.batchPresets.selectedPose?.id).toBe("po");
    expect(item.batchPresets.selectedScene?.id).toBe("bg");
    expect(item.adetailer).toHaveLength(1);
    expect(item.settings.randomizeSeed).toBe(true);
  });

  it("1枚ごとにランダム行を引き直し、固定LoRAとレシピを含める", () => {
    const { group, item } = makeItem(1);
    const picks = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const r = resolveItemBatch(item, group.recipe.fixedLoras, []);
      const choice = r.batchChoices.find((c) => c.source.startsWith("背景") || c.options.includes("beach"));
      expect(choice).toBeDefined();
      picks.add(choice!.picked);
      expect(r.batchPrompt).toContain(choice!.picked);
      expect(r.batchAllLoras.map((l) => l.name)).toContain("fixed.safetensors");
      expect(r.batchRecipe?.fixedLoras).toHaveLength(1);
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});
