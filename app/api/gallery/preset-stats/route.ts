import { NextResponse } from "next/server";
import { computePresetStats } from "@/lib/server/gallery-preset-stats";

/** GET /api/gallery/preset-stats
 *  一括キュープリセット単位の過去生成実績(生成数/販売用選択数)を返す。
 */
export async function GET() {
  return NextResponse.json({ stats: computePresetStats() });
}
