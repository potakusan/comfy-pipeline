import { getDanbooruApiKey, getDanbooruLogin } from "@/lib/setup/config";
import { ALLOWED_IMAGE_EXT, type DanbooruPost, type DanbooruRating } from "./types";

const BASE_URL = "https://danbooru.donmai.us";
/** Danbooru APIヘルプの規約により、ユーザーIDを含むカスタムUAが必須（ブラウザUA偽装は禁止）。
 *  cdn.donmai.us からの画像ダウンロード（dataset-store.tsのaddImage）でも、UA/Referer無しだと
 *  ホットリンク対策で403になるため同じヘッダーを使う。 */
export const USER_AGENT = "ComfyPipeline/1.0 (LoRA dataset builder; +https://github.com/)";
export const DANBOORU_REFERER = BASE_URL + "/";
/** 推奨レート(1req/sec)を大きく超えないための最小間隔。検索は明示的なボタン操作でのみ叩かれる前提。 */
const MIN_INTERVAL_MS = 1000;

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

interface RawDanbooruPost {
  id: number;
  file_url?: string;
  large_file_url?: string;
  preview_file_url?: string;
  file_ext?: string;
  rating?: string;
  image_width?: number;
  image_height?: number;
  source?: string;
  tag_string_general?: string;
  tag_string_character?: string;
  tag_string_copyright?: string;
  tag_string_artist?: string;
  tag_string_meta?: string;
}

function splitTags(s: string | undefined): string[] {
  return s ? s.split(" ").filter(Boolean) : [];
}

function normalizeRating(rating: string | undefined): DanbooruRating {
  if (rating === "g" || rating === "s" || rating === "q" || rating === "e") return rating;
  return "g";
}

function normalizePost(raw: RawDanbooruPost): DanbooruPost {
  const fileUrl = raw.file_url ?? raw.large_file_url ?? null;
  const fileExt = (raw.file_ext ?? "").toLowerCase();
  return {
    id: raw.id,
    fileUrl,
    previewUrl: raw.preview_file_url ?? null,
    fileExt,
    rating: normalizeRating(raw.rating),
    width: raw.image_width ?? 0,
    height: raw.image_height ?? 0,
    source: raw.source ?? "",
    tags: {
      general: splitTags(raw.tag_string_general),
      character: splitTags(raw.tag_string_character),
      copyright: splitTags(raw.tag_string_copyright),
      artist: splitTags(raw.tag_string_artist),
      meta: splitTags(raw.tag_string_meta),
    },
    available: !!fileUrl && ALLOWED_IMAGE_EXT.has(fileExt),
  };
}

/**
 * GET /posts.json をサーバー側から呼ぶ（api_keyをクライアントへ露出させない）。
 * login/api_keyは常にURLパラメータとして付与するため、失敗時に投げるエラーには
 * 呼び出しURLを含めない（サーバーログにのみ詳細を出す想定、呼び出し元でcatchする）。
 */
export async function searchPosts(params: {
  tags: string;
  page: number;
  limit: number;
  rating?: DanbooruRating;
}): Promise<DanbooruPost[]> {
  await throttle();

  const login = getDanbooruLogin();
  const apiKey = getDanbooruApiKey();

  const tagQuery = [params.tags.trim(), params.rating ? `rating:${params.rating}` : ""]
    .filter(Boolean)
    .join(" ");

  const url = new URL("/posts.json", BASE_URL);
  url.searchParams.set("tags", tagQuery);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("limit", String(params.limit));
  if (login && apiKey) {
    url.searchParams.set("login", login);
    url.searchParams.set("api_key", apiKey);
  }

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Danbooru API error: HTTP ${res.status}`);
  }
  const data = (await res.json()) as RawDanbooruPost[];
  return data.map(normalizePost);
}

/** GET /posts/{id}.json をサーバー側から呼ぶ（searchPosts同様、UA/レート制限/認証をここに集約する）。 */
export async function getPost(id: number): Promise<DanbooruPost | null> {
  await throttle();

  const login = getDanbooruLogin();
  const apiKey = getDanbooruApiKey();

  const url = new URL(`/posts/${id}.json`, BASE_URL);
  if (login && apiKey) {
    url.searchParams.set("login", login);
    url.searchParams.set("api_key", apiKey);
  }

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Referer: DANBOORU_REFERER } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Danbooru API error: HTTP ${res.status}`);
  }
  const data = (await res.json()) as RawDanbooruPost;
  return normalizePost(data);
}
