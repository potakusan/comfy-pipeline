import { NextResponse } from "next/server";

/**
 * 500エラーの共通レスポンス。生のエラー内容(スタックトレースやローカルの
 * ファイルパスを含みうる)はサーバーログにのみ出力し、クライアントには
 * 汎用メッセージだけを返す。
 */
export function apiError(context: string, e: unknown, message = "Internal Server Error") {
  console.error(`[${context}]`, e);
  return NextResponse.json({ error: message }, { status: 500 });
}
