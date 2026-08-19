import { NextResponse } from "next/server";

/**
 * リモートJSON APIへプロキシし、レスポンスのstatusをそのまま転送する。
 * models/checkpoints・models/loras・models/upscalersのGET/DELETEで
 * 共通の定型パターン(fetchしてstatusごとJSONを転送するだけ、失敗時の
 * フォールバックは無く例外はそのまま呼び出し元へ伝播する)。
 *
 * ルートによってフォールバック値の有無・statusの転送有無・local強制
 * フラグ等が異なるため、それらを含むルートはこのヘルパーの対象外。
 */
export async function proxyJson(
  remoteUrl: string,
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const res = await fetch(`${remoteUrl}${path}`, init);
  return NextResponse.json(await res.json(), { status: res.status });
}

/**
 * リモートのバイナリレスポンス(画像等)をstatus・Content-Typeごと転送する。
 * models/thumbnailで使用。フォールバック値の有無・ローカルファイル存在チェック
 * 付きの条件分岐等、単純な無条件転送でないルート(comfy/output/thumbnail等)は
 * このヘルパーの対象外。
 */
export async function proxyBinary(
  remoteUrl: string,
  path: string,
  fallbackContentType: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const res = await fetch(`${remoteUrl}${path}`, init);
  if (!res.ok) return new NextResponse("Not found", { status: res.status });
  return new NextResponse(await res.arrayBuffer(), {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? fallbackContentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
