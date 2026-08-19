import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { addExternalImage } from "@/lib/lora-dataset/dataset-store";
import { tagImageFile } from "@/lib/lora-dataset/tagger";
import { ALLOWED_IMAGE_EXT } from "@/lib/lora-dataset/types";
import { validateTaggerAvailable } from "@/lib/kohya/paths";
import { apiError } from "@/lib/server/api-error";

const USER_AGENT = "ComfyPipeline/1.0 (LoRA dataset builder; +https://github.com/)";
const DOWNLOAD_TIMEOUT_MS = 20_000;

const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function extFromUrl(url: string): string | null {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).slice(1).toLowerCase();
  return ALLOWED_IMAGE_EXT.has(ext) ? ext : null;
}

/** POST /api/lora-dataset/images/from-url  Body: { folder, url }
 *  Danbooru以外の画像URLをダウンロードし、WD14 taggerでタグ付けしてデータセットに追加する。
 */
export async function POST(req: NextRequest) {
  const { folder, url } = (await req.json()) as { folder: string; url: string };
  if (!folder || !url) return NextResponse.json({ error: "folder and url required" }, { status: 400 });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "不正なURLです" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "http/httpsのURLを指定してください" }, { status: 400 });
  }

  const taggerError = validateTaggerAvailable();
  if (taggerError) return NextResponse.json({ error: taggerError }, { status: 400 });

  let buffer: Buffer;
  let fileExt: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return NextResponse.json({ error: `画像のダウンロードに失敗しました: HTTP ${res.status}` }, { status: 400 });

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    fileExt = extFromUrl(url) ?? CONTENT_TYPE_EXT[contentType] ?? "";
    if (!fileExt) return NextResponse.json({ error: "画像形式を判定できませんでした" }, { status: 400 });

    buffer = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return apiError("lora-dataset/images/from-url download", e, "画像のダウンロードに失敗しました");
  }

  const tmpFilePath = path.join(os.tmpdir(), `cp-lora-src-${crypto.randomUUID()}.${fileExt}`);
  try {
    fs.writeFileSync(tmpFilePath, buffer);
    const tags = await tagImageFile(tmpFilePath);
    if ("error" in tags) return NextResponse.json({ error: tags.error }, { status: 500 });

    const result = addExternalImage(folder, { sourceUrl: url, buffer, fileExt, tags });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ image: result });
  } catch (e) {
    return apiError("lora-dataset/images/from-url", e, "画像の追加に失敗しました");
  } finally {
    fs.rmSync(tmpFilePath, { force: true });
  }
}
