import { NextResponse } from "next/server";
import { getComfyUIUrl } from "@/lib/setup/config";

interface ObjectInfo {
  UltralyticsDetectorProvider?: { input?: { required?: { model_name?: [string[]] } } };
  FaceDetailer?: unknown;
}

async function fetchObjectInfo(node: string): Promise<ObjectInfo> {
  const res = await fetch(`${getComfyUIUrl()}/object_info/${node}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`object_info ${node}: ${res.status}`);
  return (await res.json()) as ObjectInfo;
}

/** GET /api/comfy/detector-models
 *  ADetailer 相当(Impact Pack の FaceDetailer)が使えるかと、選べる bbox 検出モデルを返す。
 *  ファイルを走査せず ComfyUI の object_info から取るので、リモート構成でも同じ。
 */
export async function GET() {
  try {
    const [detector, face] = await Promise.all([
      fetchObjectInfo("UltralyticsDetectorProvider"),
      fetchObjectInfo("FaceDetailer"),
    ]);
    const all = detector.UltralyticsDetectorProvider?.input?.required?.model_name?.[0] ?? [];
    return NextResponse.json({
      faceDetailer: !!face.FaceDetailer,
      detectorProvider: !!detector.UltralyticsDetectorProvider,
      // FaceDetailer の bbox_detector に繋げられるのは bbox/ 配下のモデルのみ
      models: all.filter((m) => m.startsWith("bbox/")),
    });
  } catch {
    return NextResponse.json({ error: "failed to fetch detector models" }, { status: 502 });
  }
}
