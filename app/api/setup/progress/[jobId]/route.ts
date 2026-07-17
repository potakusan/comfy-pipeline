import { NextRequest, NextResponse } from "next/server"
import { getSetupJob } from "@/lib/setup-jobs"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const job = getSetupJob(jobId)
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
  return NextResponse.json(job)
}
