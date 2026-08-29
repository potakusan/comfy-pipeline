import { describe, expect, it } from "vitest";
import { getPoseGroup } from "@/lib/gallery";

describe("getPoseGroup", () => {
  it("strips the extension and ComfyUI counter suffix", () => {
    expect(getPoseGroup("1_2_1 reverse_00001_.png")).toBe("1_2_1 reverse");
  });

  it("strips a single _rev_NNNN revision suffix", () => {
    expect(getPoseGroup("1_2_1 reverse_00001__rev_0001.png")).toBe("1_2_1 reverse");
  });

  it("strips chained _rev_NNNN suffixes from re-regenerating an already-revised image", () => {
    expect(getPoseGroup("1_2_1 reverse_00001__rev_0001_rev_0002.png")).toBe("1_2_1 reverse");
  });
});
