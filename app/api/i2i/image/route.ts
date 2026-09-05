import { NextRequest, NextResponse } from "next/server";
import { readImage, readThumb, deleteImage } from "@/lib/server/i2i-pool";

/** GET /api/i2i/image?path=<.i2i相対パス>[&thumb=1]
 *  構図プール画像のバイトを返す。thumb=1 で UI 表示用の縮小 webp(自動生成)。 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("path") ?? "";
  if (!p) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  const img = req.nextUrl.searchParams.get("thumb")
    ? await readThumb(p)
    : readImage(p);
  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(img.buffer), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}

/** DELETE /api/i2i/image  Body: { path }  構図プールから1枚削除する。 */
export async function DELETE(req: NextRequest) {
  const { path: p } = (await req.json()) as { path?: string };
  if (!p) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  return NextResponse.json({ ok: deleteImage(p) });
}
