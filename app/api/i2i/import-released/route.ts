import { NextResponse } from "next/server";
import { importReleasedImagesByPose } from "@/lib/server/i2i-pool";
import { apiError } from "@/lib/server/api-error";

/** POST /api/i2i/import-released
 *  全 `*_release/` フォルダの画像をファイル名推測のポーズ別に構図プールへ取り込む。
 */
export async function POST() {
  try {
    return NextResponse.json(await importReleasedImagesByPose());
  } catch (e) {
    return apiError("i2i/import-released POST", e);
  }
}
