import { NextResponse } from "next/server";
import { getComfyUIUrl } from "@/lib/setup/config";

type ObjectInfo = Record<string, { input?: { required?: Record<string, [string[]]> } }>;

async function listOptions(node: string, field: string): Promise<string[]> {
  const res = await fetch(`${getComfyUIUrl()}/object_info/${node}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`object_info ${node}: ${res.status}`);
  const info = (await res.json()) as ObjectInfo;
  return info[node]?.input?.required?.[field]?.[0] ?? [];
}

/** GET /api/comfy/loader-models
 *  Anima 等で個別に読み込む UNet / テキストエンコーダ / VAE の選択肢を返す。
 *  ComfyUI の object_info から取るので、リモート構成でも同じ。
 */
export async function GET() {
  try {
    const [unets, textEncoders, vaes] = await Promise.all([
      listOptions("UNETLoader", "unet_name"),
      listOptions("CLIPLoader", "clip_name"),
      listOptions("VAELoader", "vae_name"),
    ]);
    return NextResponse.json({ unets, textEncoders, vaes });
  } catch {
    return NextResponse.json({ error: "failed to fetch loader models" }, { status: 502 });
  }
}
