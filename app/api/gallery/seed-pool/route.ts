import { NextRequest, NextResponse } from "next/server";
import { listReleasedSeeds } from "@/lib/server/gallery-seed-pool";

/** GET /api/gallery/seed-pool?folder=20240101-loraname
 *  指定フォルダ内で販売用に選択済みの画像のseed一覧を返す
 *  (一括キューの「シード引き継ぎ」実行の引き継ぎ元候補)。
 */
export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get("folder") ?? "";
  if (!folder) return NextResponse.json({ error: "Missing folder" }, { status: 400 });

  return NextResponse.json({ seeds: listReleasedSeeds(folder) });
}
