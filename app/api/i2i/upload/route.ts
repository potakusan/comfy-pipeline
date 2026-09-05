import { NextRequest, NextResponse } from "next/server";
import { addImageFromBuffer } from "@/lib/server/i2i-pool";
import { apiError } from "@/lib/server/api-error";

/** POST /api/i2i/upload  FormData { group, image }  ローカルファイルを構図プールへ追加。 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const group = form.get("group");
    const file = form.get("image");
    if (typeof group !== "string" || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing group or image" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
    const res = await addImageFromBuffer(group, buf, ext);
    if (!res) return NextResponse.json({ error: "Invalid group" }, { status: 400 });
    return NextResponse.json({ path: res.rel });
  } catch (e) {
    return apiError("i2i/upload POST", e);
  }
}
