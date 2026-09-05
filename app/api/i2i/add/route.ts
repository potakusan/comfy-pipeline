import { NextRequest, NextResponse } from "next/server";
import { addImageFromOutput } from "@/lib/server/i2i-pool";

/** POST /api/i2i/add  Body: { group, sourcePath }
 *  出力ディレクトリ相対パスの画像を構図プールへコピーする(ギャラリーからの保存)。
 */
export async function POST(req: NextRequest) {
  const { group, sourcePath } = (await req.json()) as {
    group?: string;
    sourcePath?: string;
  };
  if (!group || !sourcePath) {
    return NextResponse.json({ error: "Missing group or sourcePath" }, { status: 400 });
  }
  const res = await addImageFromOutput(group, sourcePath);
  if (!res) return NextResponse.json({ error: "Invalid group or source" }, { status: 400 });
  return NextResponse.json({ path: res.rel });
}
