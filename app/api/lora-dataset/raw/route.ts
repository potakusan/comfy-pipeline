import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveImageFile } from "@/lib/lora-dataset/dataset-store";
import { IMAGE_MIME } from "@/lib/server/output-dir";

/** GET /api/lora-dataset/raw?folder=&id= — ローカルに保存済みの画像バイナリを配信 */
export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get("folder") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!folder || !id) return NextResponse.json({ error: "folder and id required" }, { status: 400 });

  const filePath = resolveImageFile(folder, id);
  if (!filePath) return NextResponse.json({ error: "File not found" }, { status: 404 });

  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace(".", "").toLowerCase();
    const contentType = IMAGE_MIME[ext] || "application/octet-stream";
    return new NextResponse(buffer, {
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
