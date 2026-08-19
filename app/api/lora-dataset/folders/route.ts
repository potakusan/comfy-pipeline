import { NextRequest, NextResponse } from "next/server";
import {
  createDataset,
  deleteDataset,
  listDatasets,
  updateDataset,
} from "@/lib/lora-dataset/dataset-store";
import { apiError } from "@/lib/server/api-error";

/** GET /api/lora-dataset/folders — データセット一覧 */
export async function GET() {
  try {
    return NextResponse.json({ datasets: listDatasets() });
  } catch (e) {
    return apiError("lora-dataset/folders GET", e, "データセット一覧の取得に失敗しました");
  }
}

/** POST /api/lora-dataset/folders  Body: { name, repeat, triggerWord, includeCategories? } */
export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const result = createDataset(body);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ dataset: result });
  } catch (e) {
    return apiError("lora-dataset/folders POST", e, "データセットの作成に失敗しました");
  }
}

/** PATCH /api/lora-dataset/folders  Body: { folder, name?, repeat?, triggerWord?, includeCategories? } */
export async function PATCH(req: NextRequest) {
  const { folder, ...updates } = await req.json();
  if (!folder) return NextResponse.json({ error: "folder required" }, { status: 400 });
  try {
    const result = updateDataset(folder, updates);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ dataset: result });
  } catch (e) {
    return apiError("lora-dataset/folders PATCH", e, "データセットの更新に失敗しました");
  }
}

/** DELETE /api/lora-dataset/folders  Body: { folder } */
export async function DELETE(req: NextRequest) {
  const { folder } = await req.json();
  if (!folder) return NextResponse.json({ error: "folder required" }, { status: 400 });
  try {
    const ok = deleteDataset(folder);
    if (!ok) return NextResponse.json({ error: "データセットが見つかりません" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError("lora-dataset/folders DELETE", e, "データセットの削除に失敗しました");
  }
}
