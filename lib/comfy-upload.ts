/**
 * 画像を ComfyUI の input フォルダへアップロードし、割り当てられたファイル名を返す。
 * LoadImage ノードの `image` にそのまま渡せる。/api/comfy/upload は ComfyUI の
 * /upload/image へのプロキシ(app/api/comfy/upload/route.ts)。
 */
export async function uploadImageToComfyInput(
  data: Blob | File,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append("image", data, filename);
  form.append("type", "input");
  const res = await fetch("/api/comfy/upload", { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`ComfyUIへの画像アップロードに失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { name?: string };
  if (!json.name) throw new Error("ComfyUIがファイル名を返しませんでした");
  return json.name;
}

/** ComfyUI input フォルダの画像のプレビューURL。 */
export function comfyInputImageUrl(name: string): string {
  return `/api/comfy/view?filename=${encodeURIComponent(name)}&type=input`;
}
