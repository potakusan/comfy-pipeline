/**
 * 引き継ぎ元フォルダのシードプールに対し、実際に生成する枚数を決める。
 * 指定枚数がプールサイズを超える場合はプールサイズに切り詰める
 * (同じseedを使い回さない)。
 */
export function resolveSeedPoolBatchCount(requested: number, poolSize: number): number {
  return Math.min(requested, poolSize);
}
