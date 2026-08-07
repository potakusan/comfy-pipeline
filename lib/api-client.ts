/**
 * 自前の /api/* ルート専用のfetchラッパー。レスポンスがres.ok(2xx)でなければ
 * ボディの{error}(apiError()の共通形式、lib/server/api-error.ts参照)を
 * message化してthrowする。外部サービス(ComfyUI/Civitai/LoRA Managerなど)や
 * JSON以外のレスポンス(画像blob等)には使わない。
 */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
    );
  }
  return data as T;
}
