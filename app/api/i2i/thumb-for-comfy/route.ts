import { NextRequest, NextResponse } from "next/server";
import { readThumbForComfyName } from "@/lib/server/i2i-pool";

/** GET /api/i2i/thumb-for-comfy?name=i2i_<hash>.png
 *  ステージ済み ComfyUI 入力名に対応する .i2i 縮小画像(webp)を返す。
 *  参照画像フローティングウィンドウが原寸を読み込まないために使う。
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const img = await readThumbForComfyName(name);
  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(img.buffer), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}
