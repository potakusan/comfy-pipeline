import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { resolveImageFile } from "@/lib/lora-dataset/dataset-store";
import { IMAGE_MIME } from "@/lib/server/output-dir";

const IMMUTABLE = "public, max-age=31536000, immutable";
// データセット(学習対象)のフォルダに混ざらないよう、サムネイルはOSの一時領域にキャッシュする
const THUMB_ROOT = path.join(os.tmpdir(), "comfy-pipeline-dataset-thumbs");

async function thumbnail(filePath: string, folder: string, id: string, width: number): Promise<Buffer> {
  const cachePath = path.join(THUMB_ROOT, encodeURIComponent(folder), `${id}_${width}.webp`);
  try {
    if (fs.statSync(cachePath).mtimeMs >= fs.statSync(filePath).mtimeMs) return fs.readFileSync(cachePath);
  } catch {
    // キャッシュ無し → 下で生成する
  }
  const buffer = await sharp(filePath)
    .resize(width, undefined, { withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, buffer);
  return buffer;
}

/** GET /api/lora-dataset/raw?folder=&id=[&w=] — ローカルに保存済みの画像を配信。w指定時は幅w(px)のWebPサムネイル */
export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get("folder") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!folder || !id) return NextResponse.json({ error: "folder and id required" }, { status: 400 });

  const filePath = resolveImageFile(folder, id);
  if (!filePath) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const w = Number(req.nextUrl.searchParams.get("w"));
  try {
    if (Number.isFinite(w) && w > 0) {
      const width = Math.min(1600, Math.max(64, Math.round(w)));
      const buffer = await thumbnail(filePath, folder, id, width);
      return new NextResponse(new Uint8Array(buffer), {
        headers: { "Content-Type": "image/webp", "Cache-Control": IMMUTABLE },
      });
    }
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace(".", "").toLowerCase();
    const contentType = IMAGE_MIME[ext] || "application/octet-stream";
    return new NextResponse(buffer, {
      headers: { "Content-Type": contentType, "Cache-Control": IMMUTABLE },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
