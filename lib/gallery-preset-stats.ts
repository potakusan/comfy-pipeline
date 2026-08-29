/** 一括キュープリセット単位の過去生成実績。集計は全期間累積（lib/server/gallery-preset-stats.ts）。 */
export interface PresetGenerationStats {
  generated: number;
  released: number;
}

/** この件数未満の生成実績しかないプリセットは、良品率が統計的に信頼できないため調整しない。 */
export const MIN_SAMPLES_FOR_ADJUSTMENT = 5;

/**
 * 良品率(release率)から、期待値ベースで実際の生成枚数を算出する。
 * 「当たり1枚を確保するのに必要な試行回数」= ceil(1 / release率) を、
 * ユーザー指定のrequestedを上限としてclampする。
 */
export function computeAdjustedBatchCount(
  requested: number,
  stats: PresetGenerationStats | undefined,
): number {
  if (!stats || stats.generated < MIN_SAMPLES_FOR_ADJUSTMENT) return requested;
  if (stats.released <= 0) return requested;

  const releaseRate = stats.released / stats.generated;
  const neededTrials = Math.ceil(1 / releaseRate);
  return Math.max(1, Math.min(requested, neededTrials));
}
