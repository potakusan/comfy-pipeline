import { NextRequest, NextResponse } from "next/server";
import {
  addImage,
  deleteImage,
  listImages,
  updateImageTags,
} from "@/lib/lora-dataset/dataset-store";
import type { DanbooruPost } from "@/lib/lora-dataset/types";
import { apiError } from "@/lib/server/api-error";

/** GET /api/lora-dataset/images?folder= — データセット内の画像一覧 */
export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get("folder") ?? "";
  if (!folder) return NextResponse.json({ error: "folder required" }, { status: 400 });
  try {
    return NextResponse.json({ images: listImages(folder) });
  } catch (e) {
    return apiError("lora-dataset/images GET", e, "画像一覧の取得に失敗しました");
  }
}

/** POST /api/lora-dataset/images  Body: { folder, post: DanbooruPost } — 画像をダウンロードして追加 */
export async function POST(req: NextRequest) {
  const { folder, post } = (await req.json()) as { folder: string; post: DanbooruPost };
  if (!folder || !post) return NextResponse.json({ error: "folder and post required" }, { status: 400 });
  try {
    const result = await addImage(folder, post);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ image: result });
  } catch (e) {
    return apiError("lora-dataset/images POST", e, "画像の追加に失敗しました");
  }
}

/** PATCH /api/lora-dataset/images  Body: { folder, id, removedTags, extraTags } — タグ編集→caption再生成 */
export async function PATCH(req: NextRequest) {
  const { folder, id, removedTags, extraTags } = (await req.json()) as {
    folder: string;
    id: string;
    removedTags: string[];
    extraTags: string[];
  };
  if (!folder || !id) return NextResponse.json({ error: "folder and id required" }, { status: 400 });
  try {
    const result = updateImageTags(folder, id, removedTags ?? [], extraTags ?? []);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ image: result });
  } catch (e) {
    return apiError("lora-dataset/images PATCH", e, "タグの更新に失敗しました");
  }
}

/** DELETE /api/lora-dataset/images  Body: { folder, id } */
export async function DELETE(req: NextRequest) {
  const { folder, id } = (await req.json()) as { folder: string; id: string };
  if (!folder || !id) return NextResponse.json({ error: "folder and id required" }, { status: 400 });
  try {
    const ok = deleteImage(folder, id);
    if (!ok) return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError("lora-dataset/images DELETE", e, "画像の削除に失敗しました");
  }
}
