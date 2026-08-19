import { NextRequest, NextResponse } from "next/server";
import { getTrainingJob } from "@/lib/kohya/training-jobs";
import { cancelTraining } from "@/lib/kohya/training-run";

/** GET /api/lora-dataset/kohya/train/:jobId */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getTrainingJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(job);
}

/** DELETE /api/lora-dataset/kohya/train/:jobId — 実行中の学習を停止する */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const ok = cancelTraining(jobId);
  if (!ok) return NextResponse.json({ error: "実行中のジョブが見つかりません" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
