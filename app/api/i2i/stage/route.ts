import { NextRequest, NextResponse } from "next/server";
import { stageGroupToComfy } from "@/lib/server/i2i-pool";
import { apiError } from "@/lib/server/api-error";

/** POST /api/i2i/stage  Body: { group }
 *  グループの全画像を ComfyUI の input へアップロードし、ファイル名一覧を返す。
 */
export async function POST(req: NextRequest) {
  try {
    const { group } = (await req.json()) as { group?: string };
    if (!group) return NextResponse.json({ error: "Missing group" }, { status: 400 });
    const names = await stageGroupToComfy(group);
    return NextResponse.json({ names });
  } catch (e) {
    return apiError("i2i/stage POST", e);
  }
}
