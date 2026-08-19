import { NextRequest, NextResponse } from "next/server";
import { startTraining } from "@/lib/kohya/training-run";
import type { TrainingParams } from "@/lib/kohya/types";
import { apiError } from "@/lib/server/api-error";

/** POST /api/lora-dataset/kohya/train  Body: { params: TrainingParams } */
export async function POST(req: NextRequest) {
  const { params } = (await req.json()) as { params: TrainingParams };
  if (!params) return NextResponse.json({ error: "params required" }, { status: 400 });

  try {
    const result = startTraining(params);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    return apiError("lora-dataset/kohya/train POST", e, "学習の開始に失敗しました");
  }
}
