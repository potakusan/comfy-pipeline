import { describe, expect, it } from "vitest";
import {
  extractVariableNames,
  collectVariableUsages,
  missingRequiredInputs,
  resolveBindings,
  applyVariableBindings,
  applyPromptReplacements,
  type VariableDefs,
} from "@/lib/comfy/prompt-variables";

describe("extractVariableNames", () => {
  it("returns distinct names in order of appearance", () => {
    expect(
      extractVariableNames("blue dress, %%hadake%%, %%pose%%, %%hadake%%"),
    ).toEqual(["hadake", "pose"]);
  });
  it("ignores malformed tokens", () => {
    expect(extractVariableNames("%% bad %%, %%ok_1%%, %%no-dash%%")).toEqual([
      "ok_1",
    ]);
  });
  it("handles empty text", () => {
    expect(extractVariableNames("")).toEqual([]);
  });
});

describe("collectVariableUsages", () => {
  it("emits one usage per (name, line) with the line as snippet", () => {
    const usages = collectVariableUsages([
      {
        id: "p1",
        label: "衣装A",
        slot: "other",
        text: "shirt,\n%%hadake%%, %%extra%%\nplain",
      },
      { id: "add", label: "追加プロンプト", slot: "additional", text: "%%hadake%%" },
    ]);
    expect(usages).toEqual([
      {
        name: "hadake",
        sourceId: "p1",
        sourceLabel: "衣装A",
        slot: "other",
        snippet: "%%hadake%%, %%extra%%",
      },
      {
        name: "extra",
        sourceId: "p1",
        sourceLabel: "衣装A",
        slot: "other",
        snippet: "%%hadake%%, %%extra%%",
      },
      {
        name: "hadake",
        sourceId: "add",
        sourceLabel: "追加プロンプト",
        slot: "additional",
        snippet: "%%hadake%%",
      },
    ]);
  });
});

describe("missingRequiredInputs", () => {
  const defs: VariableDefs = {
    withDefault: { name: "withDefault", mode: "input", value: "dress lift" },
    fixedOne: { name: "fixedOne", mode: "fixed", value: "x" },
    randomOne: { name: "randomOne", mode: "random", candidates: ["a", "b"] },
  };
  it("flags only bare input vars with neither entered value nor default", () => {
    expect(
      missingRequiredInputs({
        names: ["bare", "withDefault", "fixedOne", "randomOne", "entered"],
        defs,
        inputValues: { entered: "swimsuit aside" },
      }),
    ).toEqual(["bare"]);
  });
  it("treats whitespace-only entered value as missing", () => {
    expect(
      missingRequiredInputs({ names: ["bare"], defs: {}, inputValues: { bare: "   " } }),
    ).toEqual(["bare"]);
  });
  it("flags random vars with no usable candidates and fixed vars with an empty value", () => {
    const badDefs: VariableDefs = {
      emptyRandom: { name: "emptyRandom", mode: "random", candidates: [] },
      blankRandom: { name: "blankRandom", mode: "random", candidates: ["  ", ""] },
      okRandom: { name: "okRandom", mode: "random", candidates: ["a"] },
      emptyFixed: { name: "emptyFixed", mode: "fixed", value: "" },
      okFixed: { name: "okFixed", mode: "fixed", value: "y" },
    };
    expect(
      missingRequiredInputs({
        names: ["emptyRandom", "blankRandom", "okRandom", "emptyFixed", "okFixed"],
        defs: badDefs,
        inputValues: {},
      }),
    ).toEqual(["emptyRandom", "blankRandom", "emptyFixed"]);
  });
});

describe("resolveBindings", () => {
  it("resolves fixed/input/random and falls back to defaults", () => {
    const defs: VariableDefs = {
      f: { name: "f", mode: "fixed", value: "FIXED" },
      i: { name: "i", mode: "input", value: "DEF" },
      r: { name: "r", mode: "random", candidates: ["only"] },
    };
    const out = resolveBindings({
      names: ["f", "i", "r", "j"],
      defs,
      inputValues: { j: "typed" },
      rng: () => 0,
    });
    expect(out).toEqual({ f: "FIXED", i: "DEF", r: "only", j: "typed" });
  });
  it("entered input value overrides the default", () => {
    const defs: VariableDefs = { i: { name: "i", mode: "input", value: "DEF" } };
    expect(
      resolveBindings({ names: ["i"], defs, inputValues: { i: "typed" } }),
    ).toEqual({ i: "typed" });
  });
  it("picks a random candidate using the provided rng", () => {
    const defs: VariableDefs = {
      r: { name: "r", mode: "random", candidates: ["a", "b", "c"] },
    };
    expect(
      resolveBindings({ names: ["r"], defs, inputValues: {}, rng: () => 0.99 }).r,
    ).toBe("c");
  });
});

describe("applyVariableBindings", () => {
  it("substitutes known bindings and leaves unknown tokens intact", () => {
    expect(
      applyVariableBindings("a, %%x%%, %%y%%", { x: "X" }),
    ).toBe("a, X, %%y%%");
  });
  it("cleans up commas left by an empty binding", () => {
    expect(applyVariableBindings("blue dress, %%x%%, standing", { x: "" })).toBe(
      "blue dress, standing",
    );
    expect(applyVariableBindings("%%x%%, solo", { x: "" })).toBe("solo");
    expect(applyVariableBindings("solo, %%x%%", { x: "" })).toBe("solo");
  });
});

describe("applyPromptReplacements", () => {
  it("applies replacements in order, ignoring empty from", () => {
    expect(
      applyPromptReplacements("dress lift, dress", [
        { from: "dress lift", to: "shirt lift" },
        { from: "", to: "x" },
      ]),
    ).toBe("shirt lift, dress");
  });
  it("returns text unchanged when there are no replacements", () => {
    expect(applyPromptReplacements("abc", undefined)).toBe("abc");
    expect(applyPromptReplacements("abc", [])).toBe("abc");
  });
});
