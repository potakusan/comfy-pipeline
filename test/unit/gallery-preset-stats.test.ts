import { describe, expect, it } from "vitest";
import {
  computeAdjustedBatchCount,
  MIN_SAMPLES_FOR_ADJUSTMENT,
} from "@/lib/gallery-preset-stats";
import {
  computePresetStats,
  invalidatePresetStatsCache,
} from "@/lib/server/gallery-preset-stats";

describe("computeAdjustedBatchCount", () => {
  it("履歴が無い場合は指定枚数をそのまま返す", () => {
    expect(computeAdjustedBatchCount(10, undefined)).toBe(10);
  });

  it("サンプル数がMIN_SAMPLES_FOR_ADJUSTMENT未満なら調整しない", () => {
    const stats = { generated: MIN_SAMPLES_FOR_ADJUSTMENT - 1, released: 4 };
    expect(computeAdjustedBatchCount(10, stats)).toBe(10);
  });

  it("販売用選択数が0件なら調整しない(良品率0はneededTrials=Infinityになるため)", () => {
    const stats = { generated: 20, released: 0 };
    expect(computeAdjustedBatchCount(10, stats)).toBe(10);
  });

  it("良品率100%なら1枚まで減らす", () => {
    const stats = { generated: 10, released: 10 };
    expect(computeAdjustedBatchCount(10, stats)).toBe(1);
  });

  it("良品率50%なら期待値ベースで2枚(ceil(1/0.5))になる", () => {
    const stats = { generated: 10, released: 5 };
    expect(computeAdjustedBatchCount(10, stats)).toBe(2);
  });

  it("良品率20%なら期待値ベースで5枚(ceil(1/0.2))になる", () => {
    const stats = { generated: 10, released: 2 };
    expect(computeAdjustedBatchCount(10, stats)).toBe(5);
  });

  it("必要試行回数が指定枚数を超える場合は指定枚数(上限)でclampする", () => {
    const stats = { generated: 20, released: 1 };
    // ceil(1/0.05) = 20 > requested(10) なので10のまま
    expect(computeAdjustedBatchCount(10, stats)).toBe(10);
  });
});

describe("computePresetStats のキャッシュ", () => {
  it("2回目以降は再走査せず同一オブジェクトを返す", () => {
    invalidatePresetStatsCache();
    const first = computePresetStats();
    const second = computePresetStats();
    expect(second).toBe(first);
  });

  it("invalidatePresetStatsCache 後は再走査して別オブジェクトを返す(内容は同じ)", () => {
    const before = computePresetStats();
    invalidatePresetStatsCache();
    const after = computePresetStats();
    expect(after).not.toBe(before);
    expect(after).toEqual(before);
  });
});
