import { describe, expect, it } from "vitest";
import { resolveSeedPoolBatchCount } from "@/lib/gallery-seed-pool";

describe("resolveSeedPoolBatchCount", () => {
  it("指定枚数がプールサイズ以下ならそのまま使う", () => {
    expect(resolveSeedPoolBatchCount(3, 10)).toBe(3);
  });

  it("指定枚数がプールサイズを超える場合はプールサイズに切り詰める", () => {
    expect(resolveSeedPoolBatchCount(10, 3)).toBe(3);
  });

  it("プールが空なら0になる", () => {
    expect(resolveSeedPoolBatchCount(10, 0)).toBe(0);
  });
});
