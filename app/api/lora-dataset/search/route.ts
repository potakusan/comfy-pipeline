import { NextRequest, NextResponse } from "next/server";
import { searchPosts } from "@/lib/lora-dataset/danbooru-client";
import type { DanbooruRating } from "@/lib/lora-dataset/types";
import { apiError } from "@/lib/server/api-error";

const VALID_RATINGS = new Set(["g", "s", "q", "e"]);
const DEFAULT_LIMIT = 50;
/** Danbooru posts.json の上限（APIヘルプ参照）。 */
const MAX_LIMIT = 200;

/** GET /api/lora-dataset/search?tags=&page=&limit=&rating= — Danbooru posts.json プロキシ */
export async function GET(req: NextRequest) {
  const tags = req.nextUrl.searchParams.get("tags") ?? "";
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1") || 1;
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "") || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(limitParam, 1), MAX_LIMIT);
  const ratingParam = req.nextUrl.searchParams.get("rating") ?? "";
  const rating = VALID_RATINGS.has(ratingParam) ? (ratingParam as DanbooruRating) : undefined;

  try {
    const posts = await searchPosts({ tags, page, limit, rating });
    return NextResponse.json({ posts });
  } catch (e) {
    return apiError("lora-dataset/search", e, "Danbooruの検索に失敗しました");
  }
}
