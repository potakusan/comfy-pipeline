import { NextRequest, NextResponse } from "next/server";
import { listGroupImages } from "@/lib/server/i2i-pool";

/** GET /api/i2i/images?group=<パス>  グループ(再帰)の画像相対パス一覧。 */
export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group") ?? "";
  if (!group) return NextResponse.json({ error: "Missing group" }, { status: 400 });
  return NextResponse.json({
    images: listGroupImages(group).map((p) => ({ path: p })),
  });
}
