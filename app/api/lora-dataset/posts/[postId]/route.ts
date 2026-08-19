import { NextRequest, NextResponse } from "next/server";
import { getPost } from "@/lib/lora-dataset/danbooru-client";
import { apiError } from "@/lib/server/api-error";

/** GET /api/lora-dataset/posts/:postId — Danbooru posts/{id}.json プロキシ */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const id = Number(postId);
  if (!Number.isInteger(id) || id < 0) {
    return NextResponse.json({ error: "不正な投稿IDです" }, { status: 400 });
  }

  try {
    const post = await getPost(id);
    if (!post) return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    return NextResponse.json({ post });
  } catch (e) {
    return apiError("lora-dataset/posts/:postId", e, "Danbooruの取得に失敗しました");
  }
}
