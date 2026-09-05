import { describe, expect, it } from "vitest";
import { resolvePromptVariables } from "@/hooks/pipeline/pipeline-prompt-helpers";
import type { VariableDefs } from "@/lib/comfy";

describe("resolvePromptVariables (queue-side)", () => {
  it("substitutes an input variable from the entered value", () => {
    const { prompt, bindings } = resolvePromptVariables({
      prompt: "masterpiece, %%ClothedFemale%%, 1girl",
      variableDefs: {},
      variableInputValues: { ClothedFemale: "clothed female, nude male" },
    });
    expect(prompt).toBe("masterpiece, clothed female, nude male, 1girl");
    expect(bindings.ClothedFemale).toBe("clothed female, nude male");
  });

  it("substitutes an input variable from its default when no value is entered", () => {
    const defs: VariableDefs = {
      ClothedFemale: { name: "ClothedFemale", mode: "input", value: "shirt" },
    };
    const { prompt } = resolvePromptVariables({
      prompt: "a, %%ClothedFemale%%, b",
      variableDefs: defs,
      variableInputValues: {},
    });
    expect(prompt).toBe("a, shirt, b");
  });

  it("picks a random candidate for a random-mode variable", () => {
    const defs: VariableDefs = {
      ClothedFemale: {
        name: "ClothedFemale",
        mode: "random",
        candidates: ["dress", "shirt", "swimsuit"],
      },
    };
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { prompt, bindings } = resolvePromptVariables({
        prompt: "x, %%ClothedFemale%%, y",
        variableDefs: defs,
        variableInputValues: {},
      });
      expect(["dress", "shirt", "swimsuit"]).toContain(bindings.ClothedFemale);
      expect(prompt).toBe(`x, ${bindings.ClothedFemale}, y`);
      seen.add(bindings.ClothedFemale);
    }
    expect(seen.size).toBeGreaterThan(1); // actually varies
  });

  it("strips the token (and tidy commas) when the variable resolves to empty", () => {
    const { prompt } = resolvePromptVariables({
      prompt: "masterpiece, %%ClothedFemale%%, 1girl",
      variableDefs: {},
      variableInputValues: {},
    });
    expect(prompt).toBe("masterpiece, 1girl");
  });

  it("leaves prompts without variables untouched", () => {
    const { prompt, bindings } = resolvePromptVariables({
      prompt: "masterpiece, 1girl",
      variableDefs: {},
      variableInputValues: {},
    });
    expect(prompt).toBe("masterpiece, 1girl");
    expect(bindings).toEqual({});
  });
});
